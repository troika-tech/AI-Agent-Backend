// utils/formatters.js
// Currency and text formatting helpers, including Indian numbering system and TTS replacements

function formatPrice(price) {
  let formattedPrice = String(price).replace(/,/g, "");
  if (formattedPrice.includes("₹")) {
    return (
      "₹ " +
      formattedPrice
        .replace("₹", "")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    );
  } else {
    return formattedPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

function numberToIndianWords(num) {
  if (num === 0) return "zero";
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const twoDigit = (n) =>
    n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  const threeDigit = (n) => {
    const h = Math.floor(n / 100),
      r = n % 100;
    return (h ? ones[h] + " hundred" + (r ? " " : "") : "") + (r ? twoDigit(r) : "");
  };

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  let parts = [];
  if (crore) parts.push(threeDigit(crore) + " crore");
  if (lakh) parts.push(threeDigit(lakh) + " lakh");
  if (thousand) parts.push(twoDigit(thousand) + " thousand");
  if (hundred) parts.push(threeDigit(hundred));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function rupeesToWords(rupees, paiseStr) {
  const n = parseInt(String(rupees).replace(/,/g, ""), 10);
  if (isNaN(n)) return null;
  const main = numberToIndianWords(n) + " rupees";
  if (!paiseStr) return main;
  const p = parseInt(String(paiseStr).padEnd(2, "0").slice(0, 2), 10);
  return p ? `${main} and ${numberToIndianWords(p)} paise` : main;
}

function replaceRupeesForTTS(text) {
  return String(text).replace(/₹\s*([0-9][0-9,]*)(?:\.(\d{1,2}))?/g, (match, rupees, paise) => {
    const words = rupeesToWords(rupees, paise);
    if (words) {
      return words;
    }
    // fallback: number without ₹ symbol
    return rupees.replace(/,/g, "") + (paise ? "." + paise : "") + " rupees";
  });
}

module.exports = {
  formatPrice,
  numberToIndianWords,
  rupeesToWords,
  replaceRupeesForTTS,
};
