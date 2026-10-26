const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
export const businessDate = (value = new Date()) => formatter.format(new Date(value));
