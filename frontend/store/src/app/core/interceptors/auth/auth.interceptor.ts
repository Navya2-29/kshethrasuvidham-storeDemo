import { HttpInterceptorFn } from '@angular/common/http';
import { AuthStateService } from '../../services/auth/auth-state.service';
import { inject } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
 const authState = inject(AuthStateService);

  const token = authState.token();
 
  if(token){
    req=req.clone({
      setHeaders:{
       Authorization: `Bearer ${token}`
      }
    })
  }
  return next(req);
};
