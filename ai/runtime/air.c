
#include <stdint.h>
static uint32_t heap = 16;

__attribute__((visibility("default"))) int version(void){ return 2; }
__attribute__((visibility("default"))) uint32_t heap_base(void){ return heap; }

__attribute__((visibility("default"))) uint32_t heap_capacity(void){
    return 0; /* JS reads memory.buffer.byteLength as the authoritative capacity. */
}

__attribute__((visibility("default"))) uint32_t heap_alloc(uint32_t n){
    if(!n) return 0;
    uint32_t old = heap;
    uint32_t aligned = (n + 15u) & ~15u;
    heap += aligned;
    return old;
}

__attribute__((visibility("default"))) void heap_free(uint32_t p){ (void)p; }
