import type { ArtworkKind } from "@/lib/types";

type Props = {
  kind: ArtworkKind;
  tone: string;
  className?: string;
  /** Slightly different composition for hover/second image */
  variant?: 1 | 2;
  /** Multiply stroke weight — raise it for small thumbnails so lines stay visible */
  strokeScale?: number;
  /** Skip the generated background + ground shadow (for use over colored surfaces) */
  bare?: boolean;
};

/**
 * رسم متجهي مولّد لكل منتج — لا صور خارجية، لا CLS، ولا تكاليف CDN.
 * عند ربط متجر حقيقي استبدله بـ <Image /> مع صور المنتجات الفعلية.
 */
export default function ProductArtwork({
  kind,
  tone,
  className = "",
  variant = 1,
  strokeScale = 1,
  bare = false,
}: Props) {
  const uid = `${kind}-${tone.replace("#", "")}-${variant}`;
  const stroke = `url(#stroke-${uid})`;
  const soft = `url(#soft-${uid})`;

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor={tone} stopOpacity="0.26" />
          <stop offset="55%" stopColor={tone} stopOpacity="0.09" />
          <stop offset="100%" stopColor="#fbf8f5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`stroke-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.8" />
          <stop offset="45%" stopColor={tone} />
          <stop offset="100%" stopColor={tone} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`soft-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.10" />
        </linearGradient>
      </defs>

      {!bare && <rect width="400" height="400" fill={`url(#bg-${uid})`} />}

      {/* Ground shadow */}
      {!bare && (
        <ellipse
          cx="200"
          cy={variant === 1 ? 318 : 322}
          rx={variant === 1 ? 86 : 74}
          ry="10"
          fill={tone}
          opacity="0.12"
        />
      )}

      <g
        fill="none"
        stroke={stroke}
        strokeWidth={2.6 * strokeScale}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "perfume" && <Perfume uid={uid} soft={soft} />}
        {kind === "necklace" && <Necklace uid={uid} soft={soft} />}
        {kind === "earrings" && <Earrings uid={uid} soft={soft} />}
        {kind === "bracelet" && <Bracelet uid={uid} soft={soft} />}
        {kind === "ring" && <Ring uid={uid} soft={soft} />}
        {kind === "set" && <SetPiece uid={uid} soft={soft} />}
        {kind === "watch" && <Watch uid={uid} soft={soft} />}
        {kind === "cufflinks" && <Cufflinks uid={uid} soft={soft} />}
        {kind === "bag" && <Bag uid={uid} soft={soft} />}
      </g>
    </svg>
  );
}

type Sub = { uid: string; soft: string };

function Perfume({ uid, soft }: Sub) {
  return (
    <g>
      {/* cap */}
      <rect x="178" y="88" width="44" height="40" rx="6" fill={`url(#${soft})`} />
      <line x1="178" y1="100" x2="222" y2="100" opacity="0.45" />
      {/* neck */}
      <rect x="186" y="128" width="28" height="22" rx="3" />
      {/* shoulders + body */}
      <path d="M160 190 L160 176 Q160 160 176 156 L224 156 Q240 160 240 176 L240 190" />
      <rect
        x="132"
        y="188"
        width="136"
        height="132"
        rx="14"
        fill={`url(#${soft})`}
      />
      {/* label */}
      <rect x="164" y="222" width="72" height="52" rx="4" opacity="0.75" />
      <line x1="176" y1="240" x2="224" y2="240" opacity="0.5" />
      <line x1="186" y1="254" x2="214" y2="254" opacity="0.35" />
      {/* highlight */}
      <path d="M150 210 L150 296" opacity="0.3" strokeWidth="6" />
    </g>
  );
}

function Necklace({ uid, soft }: Sub) {
  return (
    <g>
      <path
        d="M92 118 Q200 316 308 118"
        strokeDasharray="1.5 7"
        strokeWidth="4"
        opacity="0.85"
      />
      <path d="M92 118 Q200 316 308 118" opacity="0.18" />
      {/* pendant */}
      <circle cx="200" cy="292" r="18" fill={`url(#${soft})`} />
      <circle cx="200" cy="292" r="6" opacity="0.6" />
      <path d="M200 274 L200 266" />
      {/* clasp */}
      <circle cx="92" cy="118" r="4" />
      <circle cx="308" cy="118" r="4" />
    </g>
  );
}

function Earrings({ uid, soft }: Sub) {
  return (
    <g>
      <circle cx="146" cy="212" r="56" fill={`url(#${soft})`} />
      <circle cx="254" cy="212" r="56" fill={`url(#${soft})`} />
      <path d="M146 148 L146 138" />
      <path d="M254 148 L254 138" />
      <circle cx="146" cy="134" r="3.5" />
      <circle cx="254" cy="134" r="3.5" />
      <path d="M132 212 A14 14 0 0 1 160 212" opacity="0.35" />
      <path d="M240 212 A14 14 0 0 1 268 212" opacity="0.35" />
    </g>
  );
}

function Bracelet({ uid, soft }: Sub) {
  return (
    <g>
      <ellipse cx="200" cy="212" rx="96" ry="66" fill={`url(#${soft})`} />
      <ellipse cx="200" cy="212" rx="96" ry="66" opacity="0.25" strokeWidth="1.6" />
      <path d="M200 146 L200 132" />
      <path
        d="M200 132 c-10 -12 -26 -2 -20 10 c4 8 20 16 20 16 s16 -8 20 -16 c6 -12 -10 -22 -20 -10 Z"
        fill={`url(#${soft})`}
        strokeWidth="2.2"
      />
      <circle cx="200" cy="278" r="5" opacity="0.5" />
    </g>
  );
}

function Ring({ uid, soft }: Sub) {
  return (
    <g>
      <ellipse cx="200" cy="248" rx="62" ry="52" fill={`url(#${soft})`} />
      <ellipse cx="200" cy="248" rx="62" ry="52" opacity="0.3" strokeWidth="1.5" />
      <path d="M200 196 L176 168 L200 146 L224 168 Z" fill={`url(#${soft})`} />
      <path d="M176 168 L224 168" opacity="0.5" />
      <path d="M200 146 L200 196" opacity="0.5" />
      <path d="M170 232 A40 30 0 0 1 200 208" opacity="0.35" />
    </g>
  );
}

function SetPiece({ uid, soft }: Sub) {
  return (
    <g>
      <path d="M120 104 Q200 216 280 104" strokeDasharray="1.5 6" strokeWidth="3.4" />
      <circle cx="200" cy="200" r="14" fill={`url(#${soft})`} />
      <circle cx="200" cy="200" r="5" opacity="0.55" />
      <circle cx="150" cy="286" r="34" fill={`url(#${soft})`} />
      <circle cx="250" cy="286" r="34" fill={`url(#${soft})`} />
      <path d="M150 252 L150 244" />
      <path d="M250 252 L250 244" />
    </g>
  );
}

function Watch({ uid, soft }: Sub) {
  return (
    <g>
      <rect x="168" y="86" width="64" height="56" rx="10" fill={`url(#${soft})`} />
      <rect x="168" y="258" width="64" height="56" rx="10" fill={`url(#${soft})`} />
      <circle cx="200" cy="200" r="68" fill={`url(#${soft})`} />
      <circle cx="200" cy="200" r="56" opacity="0.3" strokeWidth="1.4" />
      <path d="M200 200 L200 164" strokeWidth="3.4" />
      <path d="M200 200 L228 214" strokeWidth="3.4" />
      <circle cx="200" cy="200" r="3.5" />
      <path d="M200 132 L200 124" />
      <path d="M200 276 L200 284" />
    </g>
  );
}

function Cufflinks({ uid, soft }: Sub) {
  return (
    <g>
      <rect
        x="104"
        y="150"
        width="86"
        height="86"
        rx="10"
        fill={`url(#${soft})`}
        transform="rotate(-8 147 193)"
      />
      <rect
        x="212"
        y="164"
        width="86"
        height="86"
        rx="10"
        fill={`url(#${soft})`}
        transform="rotate(8 255 207)"
      />
      <circle cx="147" cy="193" r="12" opacity="0.55" />
      <circle cx="255" cy="207" r="12" opacity="0.55" />
    </g>
  );
}

function Bag({ uid, soft }: Sub) {
  return (
    <g>
      {/* handle */}
      <path
        d="M148 158 Q148 98 200 98 Q252 98 252 158"
        fill="none"
        strokeWidth="7"
        opacity="0.7"
      />
      {/* body */}
      <path
        d="M118 158 L282 158 L296 296 Q298 312 282 312 L118 312 Q102 312 104 296 Z"
        fill={`url(#${soft})`}
      />
      {/* flap */}
      <path
        d="M118 158 L282 158 L286 206 Q200 224 114 206 Z"
        fill={`url(#${soft})`}
        opacity="0.65"
      />
      <path d="M114 206 Q200 224 286 206" opacity="0.5" />
      {/* clasp */}
      <rect x="188" y="208" width="24" height="18" rx="5" fill={`url(#${soft})`} />
      <circle cx="200" cy="217" r="3.5" opacity="0.7" />
      {/* seams */}
      <path d="M132 174 L138 296" opacity="0.28" />
      <path d="M268 174 L262 296" opacity="0.28" />
      <path d="M150 312 L150 322" opacity="0.35" />
      <path d="M250 312 L250 322" opacity="0.35" />
    </g>
  );
}
