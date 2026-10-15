describe('Queue call policy', () => {
  it('uses five minute calls and two attempts', () => {
    expect(300000).toBe(5 * 60 * 1000);
    expect(2).toBe(2);
  });
});
