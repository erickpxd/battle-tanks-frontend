import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export const benchmarkInterceptor: HttpInterceptorFn = (req, next) => {
  const startTime = performance.now();

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const duration = Math.round(performance.now() - startTime);
          console.info(
            `[API Benchmark] ${req.method} ${req.urlWithParams} → ${event.status} OK (${duration}ms)`,
          );
        }
      },
      error: (error) => {
        const duration = Math.round(performance.now() - startTime);
        console.warn(
          `[API Benchmark] ${req.method} ${req.urlWithParams} → ${error.status || 'ERROR'} (${duration}ms)`,
        );
      },
    }),
  );
};
