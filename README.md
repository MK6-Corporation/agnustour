# Agnus Tour · Site de peregrinações

Site de captação de leads da Agnus Tour com as 4 peregrinações (México e Cancún, Terra Santa e Roma, Aparecida com Pe. Idlain e com Pe. Welinton), formulário de qualificação e envio pelo WhatsApp.

**Site publicado:** https://mk6-corporation.github.io/agnustour/

## O que tem aqui

| Arquivo / pasta | O que é |
|---|---|
| `agnus-tour.html` | O site pronto, em arquivo único (versão atual). |
| `index.html` | Abre o `agnus-tour.html` no endereço principal do GitHub Pages. |
| `video/` | Vídeos dos cards. Precisa ficar ao lado do `agnus-tour.html`. |
| `Codigo.gs` | Código do Google Apps Script da planilha de leads. |
| `LEIA-ME.txt` | Instruções de uso e configuração. |
| `projeto/` | Código-fonte completo: servidor Node, painel /admin, testes e build. O `projeto/agnus-tour.html` é uma versão anterior; a atual é a da raiz. |

## Ligar o formulário à planilha

Depois de implantar o `Codigo.gs` como App da Web, abra o `agnus-tour.html` aqui no GitHub (ícone de lápis), procure `window.AGNUS_PLANILHA_URL = "";` e cole a URL `/exec` entre as aspas. Ao salvar (commit), o site publicado se atualiza em cerca de 1 minuto. O passo a passo completo está no `LEIA-ME.txt`.
