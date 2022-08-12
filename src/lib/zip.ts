import { inflateRaw } from "pako";

const decoder = new TextDecoder();

export class ZipError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// End of central directory record
const EOCDMinLen = 22;
const EOCDMaxLen = EOCDMinLen + 65536;
const EOCDHeader = 0x504b0506; // PK56

function getEOCDHeader(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function getEOCDCommentLen(view: DataView, offset: number): number {
  return view.getUint16(offset + 20, true);
}

function getEOCDLen(view: DataView, offset: number): number {
  return EOCDMinLen + getEOCDCommentLen(view, offset);
}

function findEOCDOffset(view: DataView): number {
  for (
    let i = view.byteLength - EOCDMinLen;
    i > view.byteLength - EOCDMaxLen;
    i--
  ) {
    if (getEOCDHeader(view, i) === EOCDHeader) {
      if (view.byteLength - i === getEOCDLen(view, i)) {
        return i;
      }
    }
  }

  throw new ZipError("failed to find EOCD");
}

type EOCD = {
  diskNum: number;
  dirDiskNum: number;
  dirRecordsInDisk: number;
  dirRecords: number;
  dirSize: number;
  dirOffset: number;
  commentLen: number;
};

// Central directory entry
const CDEMinLen = 46;
const CDEHeader = 0x504b0102; // PK12

type CDE = {
  versionMadeBy: number;
  versionNeeded: number;
  generalPurposeBitFlag: number;
  compressionMethod: number;
  lastModTime: number;
  lastModDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  fileNameLen: number;
  extFieldLen: number;
  fileCommentLen: number;
  diskNum: number;
  internalFileAttr: number;
  externalFileAttr: number;
  localFileHeaderOffset: number;
  fileName: string;
};

// Local file header
const LocalHeaderSignature = 0x504b0304; // PK34

// Creator
const CreatorFAT = 0;
const CreatorUnix = 3;
const CreatorMacOSX = 19;
const CreatorNTFS = 11;
const CreatorVFAT = 14;

class ZipFile {
  constructor(private view: DataView, private cde: CDE) {
    const sig = view.getUint32(0, false);
    if (sig !== LocalHeaderSignature) {
      throw new ZipError("invalid local file header signature");
    }
  }

  get fileName(): string {
    return this.cde.fileName;
  }

  get compressionSize(): number {
    return this.cde.compressedSize;
  }

  get isDirectory(): boolean {
    const { fileName, versionMadeBy, externalFileAttr } = this.cde;

    const creator = versionMadeBy >> 8;
    switch (creator) {
      case CreatorUnix:
      case CreatorMacOSX:
        return ((externalFileAttr >> 16) & 0xf000) === 0x4000;

      case CreatorNTFS:
      case CreatorFAT:
      case CreatorVFAT:
        return !!(externalFileAttr & 0x10);
    }

    return fileName.endsWith("/");
  }

  decompress(): Uint8Array {
    const { view, cde } = this;
    const { compressionMethod, compressedSize } = cde;

    const localFileNameLen = view.getUint16(26, true);
    const localExtFieldLen = view.getUint16(28, true);
    const dataOffset = 30 + localFileNameLen + localExtFieldLen;

    switch (compressionMethod) {
      case 0:
        return new Uint8Array(
          view.buffer.slice(
            view.byteOffset + dataOffset,
            view.byteOffset + dataOffset + compressedSize
          )
        );
      case 8:
        return inflateRaw(
          new Uint8Array(
            view.buffer,
            view.byteOffset + dataOffset,
            compressedSize
          )
        );
      default:
        throw new ZipError(
          `unsupported compression method: ${compressionMethod}`
        );
    }
  }
}

export class ZipReader {
  readonly files: ZipFile[];

  constructor(view: DataView) {
    const eocdOffset = findEOCDOffset(view);

    const eocd: EOCD = {
      diskNum: view.getUint16(eocdOffset + 4, true),
      dirDiskNum: view.getUint16(eocdOffset + 6, true),
      dirRecordsInDisk: view.getUint16(eocdOffset + 8, true),
      dirRecords: view.getUint16(eocdOffset + 10, true),
      dirSize: view.getUint32(eocdOffset + 12, true),
      dirOffset: view.getUint32(eocdOffset + 16, true),
      commentLen: view.getUint16(eocdOffset + 20, true),
    };

    if (
      eocd.dirRecords === 0xffff ||
      eocd.dirSize === 0xffff ||
      eocd.dirOffset === 0xffffffff
    ) {
      throw new ZipError("ZIP64 is unsupported");
    }

    const baseOffset = eocdOffset - eocd.dirSize - eocd.dirOffset;

    this.files = [];
    const dirOffset = baseOffset + eocd.dirOffset;
    let offset = dirOffset;
    for (let i = 0; i < eocd.dirRecords; i++) {
      if (offset + CDEMinLen > eocdOffset) {
        throw new ZipError("invalid record count");
      }
      const fileNameLen = view.getUint16(offset + 28, true);
      const extFieldLen = view.getUint16(offset + 30, true);
      const fileCommentLen = view.getUint16(offset + 32, true);
      const len = CDEMinLen + fileNameLen + extFieldLen + fileCommentLen;
      if (offset + len > eocdOffset) {
        throw new ZipError("invalid record count");
      }

      const header = view.getUint32(offset, false);
      if (header !== CDEHeader) {
        throw new ZipError("failed to find file header");
      }

      const fileName = decoder.decode(
        new Uint8Array(view.buffer, view.byteOffset + offset + 46, fileNameLen)
      );
      const cde: CDE = {
        versionMadeBy: view.getUint16(offset + 4, true),
        versionNeeded: view.getUint16(offset + 6, true),
        generalPurposeBitFlag: view.getUint16(offset + 8, true),
        compressionMethod: view.getUint16(offset + 10, true),
        lastModTime: view.getUint16(offset + 12, true),
        lastModDate: view.getUint16(offset + 14, true),
        crc32: view.getUint32(offset + 16, true),
        compressedSize: view.getUint32(offset + 20, true),
        uncompressedSize: view.getUint32(offset + 24, true),
        fileNameLen,
        extFieldLen,
        fileCommentLen,
        diskNum: view.getUint16(offset + 34, true),
        internalFileAttr: view.getUint16(offset + 36, true),
        externalFileAttr: view.getUint32(offset + 38, true),
        localFileHeaderOffset: view.getUint32(offset + 42, true),
        fileName,
      };

      const fileOffset = baseOffset + cde.localFileHeaderOffset;
      this.files.push(
        new ZipFile(
          new DataView(view.buffer, view.byteOffset + fileOffset),
          cde
        )
      );

      offset += len;
    }
  }
}
