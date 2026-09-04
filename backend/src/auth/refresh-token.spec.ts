import * as bcrypt from 'bcryptjs';

describe('refresh token hash', () => {
  it('matches only the presented token', async () => {
    const token = 'refresh-token-value';
    const hash = await bcrypt.hash(token, 4);
    expect(await bcrypt.compare(token, hash)).toBe(true);
    expect(await bcrypt.compare('other', hash)).toBe(false);
  });
});
