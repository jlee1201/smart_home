interface HomePageProps {
  message: string;
  currentInput: string;
}

export function HomePage({ message, currentInput }: HomePageProps) {
  return (
    <div className="HomePage">
      <h1>TypeScript React App with GraphQL</h1>
      <p>Message from server: {message}</p>
      <p>Current input value: {currentInput}</p>
    </div>
  );
}
