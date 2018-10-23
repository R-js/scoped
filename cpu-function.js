function scoped(a, b, c, lda, ldb, ldc, m, n, k, alpha, beta) {
  //colOfEx: (col) => (col - colBase) * lda - rowBase,
  const result = c.slice(0);
  for (let j = 1; j <= n; j++) {
    const coorCJ = (j - 1) * ldc - 1;
    const coorBJ = (j - 1) * ldb - 1;
    for (let i = 1; i <= m; i++) {
      result[coorCJ + i] *= beta;
    }

    for (let l = 1; l <= k; l++) {
      let temp = alpha * b[coorBJ + l];
      const coorAL = (l-1)*lda -1;
      for (let i = 1; i <= m; i++) {
        result[coorCJ + i] += temp  * a[coorAL + i];
      }
    }
  }
  return result;
}