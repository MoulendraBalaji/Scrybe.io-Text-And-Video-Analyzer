/* ============================================================
   RankBadge — clay-relief medallions for top-3, mono for the rest
   ============================================================ */

const METALS = {
  0: 'gold',
  1: 'silver',
  2: 'bronze',
};

export function RankBadge({ rank }) {
  const metal = METALS[rank];
  if (metal) {
    return (
      <span className={`rank-medallion rank-medallion--${metal}`} aria-label={`Rank ${rank + 1}`}>
        {rank + 1}
      </span>
    );
  }
  return (
    <span className="rank-medallion" aria-label={`Rank ${rank + 1}`}>
      {rank + 1}
    </span>
  );
}
