
#include <stdint.h>

#define MAGIC0 'N'
#define MAGIC1 'R'
#define MAGIC2 'X'
#define MAGIC3 'L'
#define MAGIC4 'M'
#define MAGIC5 '1'

static uint32_t heap = 65536;
static uint32_t model_ptr = 0;
static uint32_t model_len = 0;
static uint32_t model_matrix = 0;
static uint32_t output_ptr = 0;
static uint32_t output_cap = 0;
static uint32_t output_len = 0;
static uint32_t rng_state = 0xA17E2026u;

static uint32_t mem_pages(void){ return __builtin_wasm_memory_size(0); }
static int grow_pages(uint32_t pages){ return __builtin_wasm_memory_grow(0, pages) == 0xFFFFFFFFu ? -1 : 0; }
static uint32_t align16(uint32_t n){ return (n + 15u) & ~15u; }

static int ensure(uint32_t end){
    uint32_t cap = mem_pages() * 65536u;
    if(end <= cap) return 0;
    uint32_t need = end - cap;
    uint32_t pages = (need + 65535u) / 65536u;
    return grow_pages(pages);
}

__attribute__((visibility("default"))) int version(void){ return 3; }
__attribute__((visibility("default"))) uint32_t heap_base(void){ return heap; }
__attribute__((visibility("default"))) uint32_t heap_capacity(void){ return mem_pages()*65536u; }

__attribute__((visibility("default"))) uint32_t heap_alloc(uint32_t n){
    if(!n) return 0;
    uint32_t old=heap;
    uint32_t next=old+align16(n);
    if(next<old) return 0;
    if(ensure(next)!=0) return 0;
    heap=next;
    return old;
}

__attribute__((visibility("default"))) void heap_free(uint32_t p){ (void)p; }

__attribute__((visibility("default"))) int model_load(uint32_t ptr, uint32_t len){
    if(!ptr || len < 11) return -1;
    const uint8_t *p=(const uint8_t*)ptr;
    if(p[0]!=MAGIC0||p[1]!=MAGIC1||p[2]!=MAGIC2||p[3]!=MAGIC3||p[4]!=MAGIC4||p[5]!=MAGIC5) return -2;
    uint16_t ver=(uint16_t)p[7] | ((uint16_t)p[8]<<8);
    uint16_t vocab=(uint16_t)p[9] | ((uint16_t)p[10]<<8);
    if(ver!=1 || vocab!=128) return -3;
    uint32_t need=11u + 128u*128u*2u;
    if(len<need) return -4;
    uint32_t dst=heap_alloc(need);
    if(!dst) return -5;
    uint8_t *d=(uint8_t*)dst;
    for(uint32_t i=0;i<need;i++) d[i]=p[i];
    model_ptr=dst; model_len=need; model_matrix=dst+11;
    return 0;
}

static uint32_t xorshift(void){
    uint32_t x=rng_state; x^=x<<13; x^=x>>17; x^=x<<5; rng_state=x; return x;
}

static uint16_t weight(uint32_t row,uint32_t col){
    uint8_t *m=(uint8_t*)model_matrix;
    uint32_t off=(row*128u+col)*2u;
    return (uint16_t)m[off] | ((uint16_t)m[off+1]<<8);
}

__attribute__((visibility("default"))) int model_loaded(void){ return model_matrix!=0; }
__attribute__((visibility("default"))) uint32_t output_ptr_get(void){ return output_ptr; }
__attribute__((visibility("default"))) uint32_t output_len_get(void){ return output_len; }

__attribute__((visibility("default"))) int generate(uint32_t prompt_ptr,uint32_t prompt_len,uint32_t max_chars,uint32_t seed){
    if(!model_matrix) return -1;
    if(max_chars<1) max_chars=1;
    if(max_chars>32767) max_chars=32767;
    if(!output_ptr){ output_ptr=heap_alloc(32768); if(!output_ptr) return -2; output_cap=32768; }
    rng_state = seed ? seed : 0xA17E2026u;
    uint8_t *out=(uint8_t*)output_ptr;
    uint8_t last=' ';
    if(prompt_ptr && prompt_len){
        uint8_t *p=(uint8_t*)prompt_ptr;
        for(uint32_t i=0;i<prompt_len;i++){ uint8_t c=p[i]; if(c<128) last=c; }
    }
    // Start with a separator unless the prompt ends in whitespace.
    uint32_t n=0;
    if(last!=' ' && last!='\n' && max_chars>1) out[n++]=' ';
    for(;n<max_chars-1;n++){
        uint32_t row=last<128?last:32;
        uint32_t total=0;
        for(uint32_t c=0;c<128;c++) total += weight(row,c);
        if(!total){ last=' '; out[n]=last; continue; }
        uint32_t pick=xorshift()%total;
        uint32_t chosen=32;
        for(uint32_t c=0;c<128;c++){
            uint32_t w=weight(row,c);
            if(pick<w){ chosen=c; break; }
            pick-=w;
        }
        if(chosen<32 && chosen!='\n' && chosen!='\t') chosen=32;
        last=(uint8_t)chosen; out[n]=last;
        // End at a natural-ish sentence boundary after a useful amount of text.
        if(n>72 && (last=='.'||last=='!'||last=='?') && (xorshift()%4u)==0) { n++; break; }
    }
    out[n]=0; output_len=n; return 0;
}
