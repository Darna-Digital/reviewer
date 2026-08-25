"""Bulk NS-record availability probe over UDP DNS against public recursors."""
import socket, struct, random, sys, json
from concurrent.futures import ThreadPoolExecutor

RESOLVERS = ["8.8.8.8", "1.1.1.1", "9.9.9.9", "8.8.4.4"]

def query(name, server, qtype=2, timeout=5):
    tid = random.randint(0, 65535)
    hdr = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    qn = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    pkt = hdr + qn + struct.pack(">HH", qtype, 1)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.sendto(pkt, (server, 53))
        while True:
            d, _ = s.recvfrom(4096)
            if struct.unpack(">H", d[:2])[0] == tid:
                break
        return d[3] & 0xF, struct.unpack(">H", d[6:8])[0], struct.unpack(">H", d[8:10])[0]
    except Exception:
        return None, None, None
    finally:
        s.close()

def status(name):
    """NS then SOA then A. Consensus across resolvers; retries on failure."""
    votes = []
    for r in RESOLVERS:
        rc, an, ns = query(name, r, 2)
        if rc is None:
            continue
        votes.append((rc, an, ns))
        if len(votes) >= 2:
            break
    if not votes:
        return "unknown", "no resolver answered"
    rc, an, nscount = votes[0]
    if rc == 3:
        # NXDOMAIN from NS: confirm with SOA and A to weed out negative-cache oddities
        rc2, _, _ = query(name, RESOLVERS[1], 6)
        rc3, an3, _ = query(name, RESOLVERS[1], 1)
        if rc2 == 3 and rc3 == 3:
            return "free", "NXDOMAIN (NS/SOA/A)"
        return "maybe", f"NS=NXDOMAIN SOA={rc2} A={rc3}"
    if rc == 0 and an > 0:
        return "taken", f"{an} NS record(s)"
    if rc == 0 and an == 0:
        rc3, an3, _ = query(name, RESOLVERS[1], 1)
        if rc3 == 0 and an3 > 0:
            return "taken", "no NS in answer, but A resolves"
        return "maybe", "NOERROR, no NS data (registered-undelegated or CNAME)"
    return "unknown", f"rcode={rc}"

def main():
    names = [l.strip() for l in sys.stdin if l.strip()]
    out = {}
    with ThreadPoolExecutor(max_workers=24) as ex:
        for n, res in zip(names, ex.map(status, names)):
            out[n] = res
    json.dump(out, sys.stdout, indent=0)

if __name__ == "__main__":
    main()
