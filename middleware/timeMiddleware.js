const timeMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
    console.log(`${req.method} ${req.originalUrl} - ${duration.toFixed(2)} ms`);
  });

  next();
};

module.exports = timeMiddleware;
