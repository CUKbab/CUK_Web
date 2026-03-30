export const getInitialDate = () => {
  const today = new Date();
  const day = today.getDay();
  if (day === 0) { // Sunday
    today.setDate(today.getDate() + 1);
  } else if (day === 6) { // Saturday
    today.setDate(today.getDate() + 2);
  }
  return today;
};

// Helper to get ISO week number
export const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return [date.getUTCFullYear(), weekNo];
};

export const formatDateString = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
