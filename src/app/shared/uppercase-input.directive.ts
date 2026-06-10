import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgModel } from '@angular/forms';

@Directive({
  selector: `
    input[ngModel]:not([type=email]):not([type=password]):not([type=number])
               :not([type=radio]):not([type=checkbox]):not([readonly]),
    textarea[ngModel]:not([readonly])
  `,
  standalone: true
})
export class UppercaseInputDirective {
  private readonly ngModel = inject(NgModel);
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @HostListener('input')
  onInput() {
    const target = this.el.nativeElement;
    const upper = target.value.toUpperCase();
    if (target.value === upper) return;
    const pos = target.selectionStart ?? upper.length;
    target.value = upper;
    target.setSelectionRange?.(pos, pos);
    // emitModelToViewChange:false → Angular no sobreescribe el DOM (cursor se preserva)
    // emitEvent:true → valueChanges emite → ngModelChange dispara → propiedad del componente se actualiza
    this.ngModel.control.setValue(upper, { emitEvent: true, emitModelToViewChange: false });
  }
}
