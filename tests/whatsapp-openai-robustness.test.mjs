import test from 'node:test'
import assert from 'node:assert/strict'
import { createStructuredResponseWithUsage } from '../src/lib/ai/openai.ts'

const opts = { instructions: 'Extract', input: [{ role: 'user', content: 'a' }], schemaName: 'minimal', schema: { type: 'object', properties: { value: {type:'string'}}, required: ['value'], additionalProperties: false }, maxOutputTokens: 1600 }
async function withResponse(status, payload, fn) {
  const oldFetch = globalThis.fetch
  const oldKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'local-test-key'
  globalThis.fetch = async (_url, init) => {
    assert.match(init.headers.Authorization, /^Bearer local-test-key$/)
    return { ok: status >= 200 && status < 300, status, json: async () => payload }
  }
  try { await fn() } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey }
}

test('OpenAI incompleto dispara error legible, no JSON silencioso', async () => {
  await withResponse(200,{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]}, async()=> {
    await assert.rejects(createStructuredResponseWithUsage(opts), /respuesta incompleta: max_output_tokens/)
  })
})
test('OpenAI 400 conserva el motivo de error', async()=>{
  await withResponse(400,{error:{message:'modelo sin permiso'}}, async()=>{
    await assert.rejects(createStructuredResponseWithUsage(opts), /modelo sin permiso/)
  })
})
test('OpenAI correcto devuelve datos estructurados', async()=>{
  await withResponse(200,{status:'completed',output:[{content:[{type:'output_text',text:'{"value":"ok"}'}]}],usage:{input_tokens:30,output_tokens:20}},async()=>{
    const result=await createStructuredResponseWithUsage(opts)
    assert.equal(result.data.value,'ok')
    assert.equal(result.usage.totalTokens,50)
  })
})
