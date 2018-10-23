function gpuFunction(a, b, c, lda, ldb, ldc, m, n, k, alpha, beta) {
  const cIndex = (ldc * this.thread.y) + this.thread.x;
  let sum = c[cIndex] * beta;

  for (let i = 0; i < k; i++) {
    const aIndex = (lda * i) + this.thread.x;
    const bIndex = (ldb * this.thread.y) + i;
    sum += a[aIndex] * alpha * b[bIndex];
  }

  return sum;
}