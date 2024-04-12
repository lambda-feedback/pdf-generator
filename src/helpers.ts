import * as fs from "fs";

export const deleteFile = (filePath: string) => {
  try {
    fs.rm(filePath, (error) => {
      if (error) {
        console.error("Cannot delete the temperorary file. Error:", error);
      }
    });
  } catch (exception) {
    console.error("Cannot delete temporary file, exception thrown.");
  }
};
