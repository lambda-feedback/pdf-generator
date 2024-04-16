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

export const errorRefiner = (
  e: string,
  TeXoutput: string,
  showDebug = false,
  labelKey?: string
) => {
  // This function takes in an error from compiling a PDF and returns an enhanced error message including the error location within the Problem Set
  //
  // Inputs:
  //  - e = String(e) where e is thrown by the PDF compilation process
  //  - TeXoutput is a string with the TeX file that contains the error
  //  - showDebug (optional) is to trigger a verbose error message if the function is not working as expected
  //  - labelKey (optional) is a RegEx key to find section labels in the TeX file
  if (typeof labelKey == "undefined") {
    labelKey = "\\lambdalabel{Q(.*?)}";
  }

  // Generate a contents page of the index of each question
  const lineCount = (input: string): number => {
    return input.split(/\r\n|\r|\n/).length;
  }; // Function to count number of lines

  const contentsPage: [number, string][] = [];
  const lambdaLabelRegex = RegExp(labelKey, "g");
  let labelArray: RegExpExecArray | null;

  contentsPage.push([1, "start"]);
  while ((labelArray = lambdaLabelRegex.exec(TeXoutput)) !== null) {
    contentsPage.push([
      lineCount(TeXoutput) -
        lineCount(TeXoutput.substring(lambdaLabelRegex.lastIndex)) +
        1,
      `${labelArray[1]}`, // +1 because of the way the counter works
    ]);
  }
  contentsPage.push([lineCount(TeXoutput), "end"]);

  // Decompose the error message to find the offending string
  const lineRegex = /l\.(\d+)/;
  const errorLine = lineRegex.exec(e); // Extract line number from Pandoc message
  if (!errorLine) {
    // Failure to parse the error message
    return "Further information could not be ascertained. " + e;
  }
  const errorLineStringPrep = errorLine ?? ["", 0]; // Extract line number from pandoc message. -2 is to remove " ." from the end.
  const errorLineString = errorLineStringPrep[1];
  const errorIndexInErrorMessage = e.indexOf(`l.${errorLineString}`); // Location the useful part of the error message
  const offendingString = e
    .substring(
      errorIndexInErrorMessage + `l.${errorLineString}`.length + 1 // Capture the offending string
    )
    .trim();
  const nearBeginning = offendingString.match(lambdaLabelRegex); // (Boolean needed because each section begins with the seeded label)

  // Locate the error in the TeX file and identify the section
  let errorLocationInContents =
    contentsPage.findIndex((element) => element[0] >= Number(errorLineString)) -
      1 ?? 0;
  if (errorLocationInContents == -2) {
    // If the location wasn't found, then plant and return the message in the last row.
    contentsPage.push([contentsPage.length + 1, "Location not identified."]);
    errorLocationInContents = contentsPage.length - 1; // -1 because indices start at zero.
  }
  if (nearBeginning) {
    errorLocationInContents++; //If near the beginning then the section is wrong by 1.
  }
  const errorLocationAllInfo = contentsPage[errorLocationInContents];
  const errorLocationString: string =
    String(errorLocationAllInfo && errorLocationAllInfo[1]) || "";

  let debugMessage: string;
  if (showDebug) {
    debugMessage = `errorLine: ${errorLine}. errorLineString: "${errorLineString}". l.errorLineString.length: "${
      `l.${errorLineString}`.length
    }". errorIndexInErrorMessage: "${errorIndexInErrorMessage}". offendingString: "${offendingString}". ${contentsPage} ${TeXoutput}`;
  } else {
    debugMessage = "";
  }

  // Enhance the error message
  e =
    `${debugMessage}Error in Q${errorLocationString} due to the following content: "${fixInlineLatex(
      offendingString.replace(lambdaLabelRegex, "")
    )}". More details from Pandoc: ` +
    fixInlineLatex(e.replace(lambdaLabelRegex, ""));
  return e;
};
export const fixInlineLatex = (text: string) => {
  // turns out $\\frac{T}{T_{0}} = $ is not valid according to pandoc, so this
  // remove any whitespace between the singular dollar signs
  const newText = replaceLegacyLatexDelimeters(text);
  return newText.replace(/(?<=\S)\s+(?=\$)|(?<=\$)\s+(?=\S)/g, "");
};

const replaceLegacyLatexDelimeters = (text: string) => {
  return text.replace(/\\\[|\\\]|\\\(|\\\)/g, "$");
};
