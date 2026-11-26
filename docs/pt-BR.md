# Sim Companies VWAP do estoque

[Escolher idioma](README.md)

Consulte o preço médio ponderado pelo volume (VWAP) e o preço unitário com desconto dos itens em estoque, por nível de qualidade. O período padrão é o dia anterior em UTC. Os gráficos diários oficiais por qualidade exigem o status Supporter no jogo.

## Instalação e atualização

1. Baixe `warehouse-vwap-v*.zip` em **Assets** e extraia os arquivos. [Versão mais recente](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Abra `chrome://extensions`, ative o **Modo do desenvolvedor** e clique em **Carregar sem compactação**. Selecione a pasta `warehouse-vwap` que contém `manifest.json`.
3. Entre no jogo e abra o estoque. Expanda **VWAP do estoque** para ver os preços dos itens em estoque ou abra um produto para consultar os preços por qualidade.

Para atualizar, substitua os arquivos na pasta carregada originalmente. Na extensão já instalada, clique no ícone de recarregar e depois atualize a aba do estoque. Ao manter a mesma pasta, você preserva as configurações e os preços em cache.

## Descontos e idioma

Na página do produto, clique na porcentagem ao lado do preço com desconto. É possível editar o desconto padrão do produto e os descontos de Q0 a Q12. Deixe um campo em branco para usar a configuração do nível superior ou digite 0 para aplicar o preço sem desconto. Os preços são recalculados ao salvar.

A extensão segue o idioma do Chrome por padrão. Para trocar, abra a extensão na barra de ferramentas e acesse **Todas as configurações → Idioma**.
