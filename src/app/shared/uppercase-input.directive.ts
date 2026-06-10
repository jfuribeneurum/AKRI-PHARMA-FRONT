import { Directive, HostListener, Self } from '@angular/core';
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
  constructor(@Self() private readonly ngModel: NgModel) {}

  @HostListener('input', ['$event.target'])
  onInput(target: HTMLInputElement | HTMLTextAreaElement) {
    const upper = target.value.toUpperCase();
    if (target.value === upper) return;
    const input = target as HTMLInputElement;
    const pos = input.selectionStart ?? upper.length;
    target.value = upper;
    input.setSelectionRange?.(pos, pos);
    this.ngModel.control.setValue(upper, { emitEvent: false });
  }
}
