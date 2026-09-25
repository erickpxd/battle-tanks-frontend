import { BulletComponent } from './bullet.component';

describe('BulletComponent', () => {
  it('should draw the projectile with an outer glow and a hot core', () => {
    const component = new BulletComponent();
    const context = {
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    component.draw(context, { x: 20, y: 30, direction: 'right' });

    expect(context.fillRect).toHaveBeenNthCalledWith(1, 17, 27, 6, 6);
    expect(context.fillRect).toHaveBeenNthCalledWith(2, 19, 29, 2, 2);
    expect(context.fillStyle).toBe('#f06436');
  });
});
