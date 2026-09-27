export default function Turbine({ size = 34 }: { size?: number }) {
  const blade = 'M20 18 L22.4 9 L20.6 1 L19.2 1 L18.4 9 Z'
  return (
    <svg className="turbine" viewBox="0 0 40 64" width={size} height={Math.round((size * 64) / 40)} aria-hidden="true">
      <path d="M18.9 21 L21.1 21 L22.4 63 L17.6 63 Z" fill="currentColor" />
      <g className="rotor" fill="currentColor">
        <path d={blade} />
        <path d={blade} transform="rotate(120 20 18)" />
        <path d={blade} transform="rotate(240 20 18)" />
        <circle cx="20" cy="18" r="2.4" />
      </g>
    </svg>
  )
}
