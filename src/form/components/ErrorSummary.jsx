export function ErrorSummary({ errors }) {
  if (!errors.length) return null;
  return (
    <div className="error-summary">
      <strong>
        Please fix {errors.length} problem{errors.length === 1 ? '' : 's'} before submitting:
      </strong>
      <ul>
        {errors.map((err, i) => (
          <li key={i}>{err.message}</li>
        ))}
      </ul>
    </div>
  );
}
