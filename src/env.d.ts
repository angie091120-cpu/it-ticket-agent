declare module '*.sql' {
  const text: string;
  export default text;
}

interface Env {
  DB: D1Database;
}
