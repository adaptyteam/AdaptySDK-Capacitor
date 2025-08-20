import { StackFrame } from './types';

export const parseStackTrace = (stackTrace: string): StackFrame[] => {
  const stackLines = stackTrace.split('\n').filter((line) => line.trim());

  const result = stackLines.map((line) => {
    // Try to parse different stack trace formats
    // Order matters! More specific patterns first

    // Format 2: at funcName (url:line:col) (common in Node.js/Android)
    // More precise regex to handle URLs with @fs/ and complex paths
    const match2 = line.match(/^\s*at\s+([^(]+)\s+\((.+)\)$/);
    if (match2) {
      const [, funcName, location] = match2;
      return parseLocationInfo(funcName.trim(), location);
    }

    // Format 1: funcName@url:line:col (common in browsers)
    // Only match if it doesn't look like "at funcName (" pattern
    const match1 = line.match(/^(.+?)@(.+?)$/);
    if (match1 && !line.trim().startsWith('at ')) {
      const [, funcName, location] = match1;

      // Special case: if line starts with @ (anonymous function)
      if (line.trim().startsWith('@')) {
        // This is an anonymous function, the whole line after @ is the location
        const fullLocation = line.trim().substring(1); // Remove leading @
        return parseLocationInfo('(anonymous)', fullLocation);
      }

      return parseLocationInfo(funcName.trim(), location);
    }

    // Format 4: funcName (url:line:col) - another variant
    const match4 = line.match(/^(.+?)\s+\((.+?)\)$/);
    if (match4) {
      const [, funcName, location] = match4;
      return parseLocationInfo(funcName.trim(), location);
    }

    // Format 3: at url:line:col (anonymous functions)
    const match3 = line.match(/^\s*at\s+(.+?)$/);
    if (match3) {
      const [, location] = match3;
      return parseLocationInfo('(anonymous)', location);
    }

    // Fallback: treat the whole line as function name
    return {
      funcName: line.trim() || '(anonymous)',
      fileName: '',
      lineNum: 0,
      colNum: 0,
      fullLocation: line,
      isSdkCode: false,
      isReactCode: false,
    };
  });

  return result;
};

function parseLocationInfo(funcName: string, location: string): StackFrame {
  // Clean up function name - remove async/await keywords
  const cleanFuncName = funcName
    .replace(/^async\s+/, '') // Remove "async " from start
    .replace(/^await\s+/, '') // Remove "await " from start
    .trim();

  // Try to extract line and column numbers
  const urlWithLineCol = location.match(/^(.+?):(\d+):(\d+)$/);
  const urlWithLine = location.match(/^(.+?):(\d+)$/);

  let url = location;
  let lineNum = 0;
  let colNum = 0;

  if (urlWithLineCol) {
    [, url] = urlWithLineCol;
    lineNum = parseInt(urlWithLineCol[2]);
    colNum = parseInt(urlWithLineCol[3]);
  } else if (urlWithLine) {
    [, url] = urlWithLine;
    lineNum = parseInt(urlWithLine[2]);
  }

  // Extract meaningful file path
  let fileName = '';
  if (url) {
    if (url.includes('/')) {
      const parts = url.split('/');
      let lastPart = parts[parts.length - 1];

      // Remove query parameters and fragments first (handle multiple params like ?t=123&v=456)
      lastPart = lastPart.split('?')[0].split('#')[0];

      // Try to show meaningful path for our code
      const srcIndex = parts.findIndex((p) => p === 'src');
      const sharedIndex = parts.findIndex((p) => p === 'shared');
      const screensIndex = parts.findIndex((p) => p === 'screens');
      const adaptyIndex = parts.findIndex((p) => p === '@adapty');

      if (srcIndex >= 0) {
        // Use path from src/
        fileName = parts.slice(srcIndex).join('/');
      } else if (screensIndex >= 0) {
        // Use path from screens/ (for user app code)
        fileName = parts.slice(screensIndex).join('/');
      } else if (sharedIndex >= 0) {
        // Use path from shared/ (for Adapty code)
        fileName = parts.slice(sharedIndex).join('/');
      } else if (adaptyIndex >= 0) {
        // Use path from @adapty/
        fileName = parts.slice(adaptyIndex).join('/');
      } else {
        // Just use filename
        fileName = lastPart;
      }

      // Clean up query params from the final path
      fileName = fileName.split('?')[0].split('#')[0];
    } else {
      fileName = url.split('?')[0].split('#')[0];
    }
  }

  const isSdkCode = url.includes('@adapty/capacitor') || url.includes('/src/');
  const isReactCode = url.includes('react-dom') || url.includes('chunk-') || url.includes('.vite/deps/');

  const result = {
    funcName: cleanFuncName || '(anonymous)',
    fileName,
    lineNum,
    colNum,
    fullLocation: location,
    isSdkCode,
    isReactCode,
  };

  return result;
}

export const showStackTraceInConsole = (
  stackTrace: string,
  funcName: string,
  message: string,
  logLevel: string,
  timestamp: string,
): void => {
  console.group(`🔍 Stack Trace for ${funcName} (${logLevel})`);
  console.log(`Message: ${message}`);
  console.log(`Time: ${timestamp}`);
  console.log('Raw stack trace:');
  console.log(stackTrace);

  console.log('Parsed frames:');

  const parsedStack = parseStackTrace(stackTrace);

  parsedStack.forEach((frame, index) => {
    if (frame.isReactCode) {
      console.log(`${index + 1}. %c${frame.funcName}`, 'color: #999; font-style: italic;');
      console.log(`   %c${frame.fullLocation}`, 'color: #999; font-size: 11px;');
    } else {
      const style = frame.isSdkCode ? 'color: #007bff; font-weight: bold;' : 'color: #333;';
      console.log(`${index + 1}. %c${frame.funcName}`, style);
      console.log(`   %c${frame.fullLocation}`, 'color: #666; font-size: 11px;');
    }
  });

  console.groupEnd();
};
