// This declaration file extends React's default HTML attribute types
// to include non-standard, but widely used, attributes for directory selection.
// This allows us to use them in our JSX without TypeScript errors.

declare namespace React {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}