import type { ComponentFixture } from '@angular/core/testing';

export function getHostElement<T>(fixture: ComponentFixture<T>): HTMLElement {
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected an HTML component host');
    return host;
}

export function getElement<K extends keyof HTMLElementTagNameMap>(
    root: ParentNode,
    tag: K,
    selector: string = tag,
): HTMLElementTagNameMap[K] {
    const element = root.querySelector<HTMLElementTagNameMap[K]>(selector);
    if (!element || element.localName !== tag) throw new Error(`Expected <${tag}> matching "${selector}"`);
    return element;
}
