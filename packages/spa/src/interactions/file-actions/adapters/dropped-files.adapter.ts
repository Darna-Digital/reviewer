import type { DroppedFile } from "../interfaces/file-actions.interfaces";

// A dropped folder arrives as a zero-byte entry in `DataTransfer.files`, so a
// drop is read through the directory-entry API instead, which walks into it.
const entriesOf = (transfer: DataTransfer): ReadonlyArray<FileSystemEntry> =>
  [...transfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry())
    .filter((entry) => entry !== null);

const fileOf = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

// Big files would blow the argument limit passed to `fromCharCode` in one go.
const CHUNK_BYTES = 0x8000;
const readBase64 = (file: File) => async () => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let at = 0; at < bytes.length; at += CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK_BYTES));
  }
  return btoa(binary);
};

// `readEntries` hands back a batch at a time and an empty batch for "that was
// all", so a folder of more than a hundred files takes several turns.
const childrenOf = async (directory: FileSystemDirectoryEntry) => {
  const reader = directory.createReader();
  const entries: Array<FileSystemEntry> = [];
  for (;;) {
    const batch = await new Promise<ReadonlyArray<FileSystemEntry>>(
      (resolve, reject) => reader.readEntries(resolve, reject)
    );
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
};

const walk = async (
  entry: FileSystemEntry,
  prefix: string
): Promise<ReadonlyArray<DroppedFile>> => {
  const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
  if (entry.isFile) {
    const file = await fileOf(entry as FileSystemFileEntry);
    return [{ relativePath, readBase64: readBase64(file) }];
  }
  const children = await childrenOf(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(
    children.map((child) => walk(child, relativePath))
  );
  return nested.flat();
};

/**
 * The files a desktop drop carries, flattened to paths relative to the drop so
 * a dropped folder keeps its shape. The transfer is read before the first
 * `await` — the browser empties it the moment the drop handler returns — while
 * each file's bytes wait until the upload asks for them.
 */
export async function droppedFiles(
  transfer: DataTransfer
): Promise<ReadonlyArray<DroppedFile>> {
  const entries = entriesOf(transfer);
  const walked = await Promise.all(entries.map((entry) => walk(entry, "")));
  return walked.flat();
}
