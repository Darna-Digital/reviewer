"""Bulk domain-availability probe: UDP NS/SOA/A queries across many public recursors."""
import socket, struct, random, sys, json
from concurrent.futures import ThreadPoolExecutor

RESOLVERS = [
    "8.8.8.8", "1.1.1.1", "9.9.9.9", "8.8.4.4", "1.0.0.1",
    "149.112.112.112", "208.67.222.222", "208.67.220.220",
    "94.140.14.14", "64.6.64.6", "76.76.2.0", "185.228.168.9",
]
NS, A, SOA = 2, 1, 6

def query(name, server, qtype=NS, timeout=4, cd=False):
    tid = random.randint(0, 65535)
    flags = 0x0100 | (0x0010 if cd else 0)
    hdr = struct.pack(">HHHHHH", tid, flags, 1, 0, 0, 0)
    qn = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    pkt = hdr + qn + struct.pack(">HH", qtype, 1)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.sendto(pkt, (server, 53))
        for _ in range(4):
            d, _a = s.recvfrom(4096)
            if struct.unpack(">H", d[:2])[0] == tid:
                return d[3] & 0xF, struct.unpack(">H", d[6:8])[0]
        return None, None
    except Exception:
        return None, None
    finally:
        s.close()

def first_clean(name, qtype, servers, cd=False):
    """First non-SERVFAIL, non-timeout answer from the resolver list."""
    for srv in servers:
        rc, an = query(name, srv, qtype, cd=cd)
        if rc is not None and rc != 2:
            return rc, an, srv
    return None, None, None

def status(name):
    order = RESOLVERS[:]
    random.shuffle(order)
    rc, an, _ = first_clean(name, NS, order)

    if rc is None:                       # SERVFAIL/timeout everywhere -> retry with DNSSEC off
        rc, an, _ = first_clean(name, NS, order, cd=True)
        if rc is None:
            return "unknown", "SERVFAIL on every resolver (NS, incl. CD=1)"

    if rc == 0 and an and an > 0:
        return "taken", f"{an} NS record(s)"

    if rc == 3:                          # NXDOMAIN -> corroborate with SOA and A
        rc2, _, _ = first_clean(name, SOA, order)
        rc3, an3, _ = first_clean(name, A, order)
        if rc2 == 3 and rc3 == 3:
            return "free", "NXDOMAIN on NS, SOA and A"
        return "maybe", f"NS=NXDOMAIN but SOA={rc2} A={rc3}"

    if rc == 0 and not an:               # NOERROR/NODATA -> does anything resolve?
        rc3, an3, _ = first_clean(name, A, order)
        if rc3 == 0 and an3:
            return "taken", "no NS in answer but A resolves"
        return "maybe", "NOERROR with no NS data"

    return "unknown", f"rcode={rc}"

def main():
    names = [l.strip() for l in sys.stdin if l.strip()]
    with ThreadPoolExecutor(max_workers=32) as ex:
        out = dict(zip(names, ex.map(status, names)))
    json.dump(out, sys.stdout, separators=(",", ":"))

if __name__ == "__main__":
    main()
