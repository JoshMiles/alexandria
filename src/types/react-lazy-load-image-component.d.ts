declare module 'react-lazy-load-image-component' {
  import { ComponentType, CSSProperties } from 'react';

  export interface LazyLoadImageProps {
    alt?: string;
    src: string;
    placeholderSrc?: string;
    effect?: string;
    threshold?: number;
    width?: string | number;
    height?: string | number;
    style?: CSSProperties;
    className?: string;
    onError?: () => void;
    onLoad?: () => void;
    beforeLoad?: () => void;
    afterLoad?: () => void;
    visibleByDefault?: boolean;
    wrapperClassName?: string;
    wrapperProps?: object;
    placeholder?: ComponentType<any>;
    delayMethod?: 'throttle' | 'debounce';
    delayTime?: number;
    useIntersectionObserver?: boolean;
    intersectionObserverOptions?: IntersectionObserverInit;
  }

  export const LazyLoadImage: ComponentType<LazyLoadImageProps>;
  export default LazyLoadImage;
}

declare module 'react-lazy-load-image-component/src/effects/blur.css' {
  const content: any;
  export default content;
} 