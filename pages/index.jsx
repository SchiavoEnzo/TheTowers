import Head from 'next/head';
export default function Directory(){
  return <main lang="pt-BR"><Head><title>As Torres · Arquivo de operações</title></Head>
    <small>AS TORRES / CENTRAL DE OPERAÇÕES</small><h1>Arquivo<br/>paranormal<span>.</span></h1>
    <p>API para agentes, ameaças e campanhas de RPG.</p>
    <section><h2>01 / Identificação</h2><code>POST /api/auth/register</code><code>POST /api/auth/login</code><code>GET · PATCH /api/profile</code></section>
    <section><h2>02 / Arquivos de campo</h2><code>GET /api/agents</code><code>GET /api/threats</code><code>GET /api/campaigns</code></section>
    <footer>Use o token Bearer nas requisições autenticadas. Exemplos no README do projeto.</footer>
    <style jsx global>{`*{box-sizing:border-box}body{margin:0;background:#0e0e10;color:#fafafa;font:17px system-ui}main{max-width:850px;margin:auto;padding:8vh 6vw}small,h2,span{color:#ff515c}small,h2,code,footer{font-family:monospace}h1{font-size:clamp(54px,9vw,98px);letter-spacing:-.07em;line-height:.92;margin:30px 0}section{border-top:1px solid #515155;margin-top:28px}h2{font-size:16px}code{display:block;padding:5px 0}footer{margin-top:44px;color:#ccc}`}</style>
  </main>
}
