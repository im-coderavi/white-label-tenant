import { computeEffectivePrice } from '../../src/modules/checkout/checkout.service';

describe('computeEffectivePrice', () => {
  it('uses customPrice when set', () => {
    expect(computeEffectivePrice(100, { customPrice: 75, discountPercent: 10 })).toBe(75);
  });

  it('applies discountPercent when customPrice is not set', () => {
    expect(computeEffectivePrice(500, { customPrice: null, discountPercent: 20 })).toBe(400);
  });

  it('falls back to basePrice when neither is set', () => {
    expect(computeEffectivePrice(500, { customPrice: null, discountPercent: null })).toBe(500);
  });
});
