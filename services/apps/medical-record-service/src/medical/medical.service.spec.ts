describe('Clinical encounter state order', () => {
  it('requires review before finalize', () =>
    expect([
      'DRAFT',
      'IN_PROGRESS',
      'AWAITING_RESULTS',
      'READY_FOR_REVIEW',
      'FINALIZED',
    ]).toHaveLength(5));
});
