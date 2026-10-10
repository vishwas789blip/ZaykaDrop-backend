import DataURIASync from "datauri/parser";
import path from "path";

const getBuffer = (file:any) => {
  const parser = new DataURIASync();
  const extName = path.extname(file.originalname).toString();
  return parser.format(extName, file.buffer);
}

export default getBuffer;