declare module "wink-lemmatizer" {
  const lemmatizer: {
    verb: (word: string) => string;
    noun: (word: string) => string;
    adjective: (word: string) => string;
    lemmatizeVerb: (word: string) => string;
    lemmatizeNoun: (word: string) => string;
    lemmatizeAdjective: (word: string) => string;
  };
  export default lemmatizer;
}
