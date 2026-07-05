import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WaveformSVG } from '../../components/timeline/WaveformSVG';
import { BLOCK_TOP, BLOCK_HEIGHT } from '../../utils/constants';

const CENTER_Y = BLOCK_TOP + BLOCK_HEIGHT / 2;

const workBlock = { id: 'a', type: 'work', duration: 10, label: '' };
const restBlock = { id: 'b', type: 'rest', duration: 5, label: '' };

describe('WaveformSVG', () => {
  it('renders an SVG element', () => {
    const { container } = render(<WaveformSVG blocks={[workBlock]} pxPerSecond={20} width={300} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders no path element when blocks is empty', () => {
    const { container } = render(<WaveformSVG blocks={[]} pxPerSecond={20} width={300} />);
    expect(container.querySelector('path')).not.toBeInTheDocument();
  });

  it('renders a path element when blocks are present', () => {
    const { container } = render(<WaveformSVG blocks={[workBlock]} pxPerSecond={20} width={300} />);
    expect(container.querySelector('path')).toBeInTheDocument();
  });

  it('SVG width matches the width prop', () => {
    const { container } = render(<WaveformSVG blocks={[workBlock]} pxPerSecond={20} width={500} />);
    expect(container.querySelector('svg').getAttribute('width')).toBe('500');
  });

  it('path starts at CENTER_Y for any block type', () => {
    const { container: c1 } = render(<WaveformSVG blocks={[workBlock]} pxPerSecond={20} width={300} />);
    const { container: c2 } = render(<WaveformSVG blocks={[restBlock]} pxPerSecond={20} width={300} />);
    expect(c1.querySelector('path').getAttribute('d')).toMatch(new RegExp(`^M 0 ${CENTER_Y}`));
    expect(c2.querySelector('path').getAttribute('d')).toMatch(new RegExp(`^M 0 ${CENTER_Y}`));
  });

  it('path width matches duration × pxPerSecond', () => {
    const { container } = render(<WaveformSVG blocks={[workBlock]} pxPerSecond={20} width={300} />);
    const d = container.querySelector('path').getAttribute('d');
    expect(d).toContain('H 200');
  });

  it('path spans the combined duration of multiple blocks', () => {
    const { container } = render(
      <WaveformSVG blocks={[workBlock, restBlock]} pxPerSecond={20} width={400} />
    );
    const d = container.querySelector('path').getAttribute('d');
    // 10s + 5s = 15s × 20px = 300px
    expect(d).toContain('H 300');
  });

  it('is pointer-events none so it does not block clicks', () => {
    const { container } = render(<WaveformSVG blocks={[workBlock]} pxPerSecond={20} width={300} />);
    expect(container.querySelector('svg').style.pointerEvents).toBe('none');
  });
});
