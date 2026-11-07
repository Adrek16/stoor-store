import { StarIcon } from "./icons";

export default function Rating({
  value,
  reviews,
  className = "",
}: {
  value: number;
  reviews?: number;
  className?: string;
}) {
  // لا نعرض تقييماً وهمياً: إن لم توجد مراجعات حقيقية لا تظهر النجوم.
  if (reviews === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5 text-copper">
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon
            key={i}
            className={`size-3 ${i < Math.round(value) ? "opacity-100" : "opacity-25"}`}
          />
        ))}
      </div>
      <span className="num text-[0.7rem] font-semibold text-ink-soft">{value.toFixed(1)}</span>
      {reviews !== undefined && (
        <span className="text-[0.68rem] text-ink-mute">({reviews})</span>
      )}
    </div>
  );
}
