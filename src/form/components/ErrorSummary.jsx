export function ErrorSummary({ errors }) {
  if (!errors.length) return null;
  return (
    <div className="mb-3 rounded-md bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
      <strong className="text-rose-200">Please fix the following:</strong>
      <ul className="mt-1 list-disc pl-5">
        {errors.map((err, i) => (
          <li key={i}>{err.message}</li>
        ))}
      </ul>
    </div>
  );
}
