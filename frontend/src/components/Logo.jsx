// Logo.jsx — Symbi.ai wordmark
// Uses DM Mono for the monospace tech feel.
// The dot after "symbi" is amber — single deliberate accent.
export default function Logo({ size = 'md' }) {
  const sizes = { sm: '15px', md: '18px', lg: '24px' };
  const fs = sizes[size] || sizes.md;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: fs,
      fontWeight: 500,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em',
      userSelect: 'none',
    }}>
      symbi<span style={{ color: 'var(--accent)' }}>.</span>ai
    </span>
  );
}