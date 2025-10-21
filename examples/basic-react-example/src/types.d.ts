declare module '*.json' {
  const value: {
    token?: string;
    ios_bundle?: string;
  };
  export default value;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
