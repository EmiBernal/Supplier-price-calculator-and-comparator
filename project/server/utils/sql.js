function prepareSql(sql = '') {
  let text = sql;
  let appendDoNothing = false;

  if (/INSERT\s+OR\s+IGNORE/i.test(text)) {
    text = text.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT');
    appendDoNothing = true;
  }

  text = text.replace(/COLLATE\s+NOCASE/gi, '');

  let index = 0;
  text = text.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });

  if (appendDoNothing) {
    text = `${text} ON CONFLICT DO NOTHING`;
  }

  return text;
}

module.exports = { prepareSql };
