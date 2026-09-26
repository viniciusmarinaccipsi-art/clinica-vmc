// Pacote 16.5 · Catálogo do registro de automonitoramento + textos da interface
// GERADO POR SCRIPT a partir de 16.5_catalogo_automonitoramento.md (22/09/2026, conferido 23/09) — não editar à mão.
// Textos da interface: coluna "Proposta" de 16.5_textos_interface.md e "O que fica igual" (lidos do index-dev.html, Pacote 17.0).
export const catalogo = {
 "neg": {
  "sit": {
   "nome": "Situação",
   "grupos": [
    {
     "n": 1,
     "titulo": "Situações Interpessoais",
     "chave": "neg_sit_tipo_interpessoais",
     "desc": "Marque quando envolveu interações com outras pessoas",
     "itens": [
      "Ser comparado com algo ou alguém",
      "Receber críticas ou feedbacks negativos",
      "Conflitos, brigas ou discussões com outra pessoa",
      "Ser rejeitado, ignorado ou excluído numa situação",
      "Ver-se incompreendido, invalidado ou desrespeitado"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Situações de Desempenho",
     "chave": "neg_sit_tipo_desempenho",
     "desc": "Marque quando envolveu avaliações sobre tarefas e resultados",
     "itens": [
      "Acúmulo de tarefas ou sobrecarga",
      "Realizar tarefas novas ou desafiadoras",
      "Receber pressão por prazos ou cobranças",
      "Avaliação ou exposição diante de outras pessoas",
      "Lidar com erros, falhas ou resultados abaixo do esperado"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Situações de Solidão / Inatividade",
     "chave": "neg_sit_tipo_solidao",
     "desc": "Marque quando envolveu estar sozinho ou sem atividades",
     "itens": [
      "Lidar com o tédio e ociosidade",
      "Estar sozinho e/ou sem atividades",
      "Perceber-se inútil ou sem relevância",
      "Cancelamento de planos ou expectativas frustradas",
      "Sentir-se solitário e vazio em momentos específicos do dia"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Situações de Perda ou Mudança",
     "chave": "neg_sit_tipo_perda",
     "desc": "Marque quando envolveu perdas, mudanças ou incertezas",
     "itens": [
      "Ter incertezas sobre o futuro",
      "Passar por dificuldades financeiras",
      "Mudanças inesperadas na rotina ou planos",
      "Perda ou afastamento de alguém importante",
      "Problemas de saúde (próprios ou de alguém próximo)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Situações Internas (sem evento externo claro)",
     "chave": "neg_sit_tipo_internas",
     "desc": "Marque quando envolveu gatilhos internos - sem um evento externo definido",
     "itens": [
      "Lembranças ou memórias indesejadas",
      "Ruminando o que eu deveria fazer ou ter feito",
      "Sensações físicas e emocionais desagradáveis",
      "Pensamentos intrusivos que \"surgiram do nada\"",
      "Imaginar como as coisas deveriam ser diferentes"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": null,
   "rotulo": null
  },
  "emo": {
   "nome": "Emoções Desagradáveis",
   "grupos": [
    {
     "n": 1,
     "titulo": "Tristeza / Depressão",
     "chave": "neg_emo_tristeza",
     "desc": "\"Quando sentimos que perdemos algo importante, que as coisas não estão bem conosco ou que o futuro parece sem esperança.\"",
     "itens": [
      "Triste",
      "Solitário(a)",
      "Deprimido(a)",
      "Desanimado(a)",
      "Desesperançoso(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Ansiedade / Medo",
     "chave": "neg_emo_ansiedade",
     "desc": "\"Quando percebemos perigo ou ameaça, sentimos que algo ruim pode acontecer ou temos incertezas sobre o futuro.\"",
     "itens": [
      "Ansioso(a)",
      "Inseguro(a)",
      "Apreensivo(a)",
      "Preocupado(a)",
      "Amedrontado(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Raiva / Irritação",
     "chave": "neg_emo_raiva",
     "desc": "\"Quando não concordamos com algo, sentimos que fomos tratados de forma injusta ou desrespeitados.\"",
     "itens": [
      "Irritado(a)",
      "Furioso(a)",
      "Ofendido(a)",
      "Frustrado(a)",
      "Indignado(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Culpa / Vergonha",
     "chave": "neg_emo_culpa",
     "desc": "\"Quando sentimos que cometemos um erro ou que há algo inadequado em nossas atitudes ou comportamentos.\"",
     "itens": [
      "Culpado(a)",
      "Humilhado(a)",
      "Arrependido(a)",
      "Constrangido(a)",
      "Envergonhado(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Ciúme / Inveja",
     "chave": "neg_emo_ciume",
     "desc": "\"Quando sentimos que um relacionamento está ameaçado ou que outros possuem algo que admiramos ou desejamos.\"",
     "itens": [
      "Invejoso(a)",
      "Possessivo(a)",
      "Enciumado(a)",
      "Amargurado(a)",
      "Desconfiado(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": [
    "Nenhum",
    "Pouco",
    "Moderado",
    "Muito",
    "Intenso"
   ],
   "rotulo": "Desconforto:"
  },
  "fis": {
   "nome": "Reações Físicas de Mal-Estar",
   "grupos": [
    {
     "n": 1,
     "titulo": "Ativação / Aceleração",
     "chave": "neg_fis_ativacao",
     "desc": "\"Quando as sensações corporais envolvem um estado de alerta ou preparação para agir diante de uma ameaça ou perigo.\"",
     "itens": [
      "Coração acelerado",
      "Tremores ou estremecimentos",
      "Respiração rápida ou ofegante",
      "Sudorese ou calafrios repentinos",
      "Agitação (dificuldade em ficar parado)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Desativação / Lentificação",
     "chave": "neg_fis_desativacao",
     "desc": "\"Quando as sensações corporais envolvem um estado de apatia, como se faltassem forças, ânimo ou energia.\"",
     "itens": [
      "Cansaço ou fadiga",
      "Sensação de esgotamento",
      "Lentificação nos movimentos",
      "Falta de energia ou disposição",
      "Falta de interesse ou motivação"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Tensão / Contração",
     "chave": "neg_fis_tensao",
     "desc": "\"Quando as sensações corporais envolvem contrações ou rigidez muscular diante de algo estressante, ou que nos causa repudio e desaprovação.\"",
     "itens": [
      "Tensão ou rigidez muscular",
      "Aperto ou pressão no peito",
      "Punhos ou mandíbula cerrados",
      "Ombros e pescoço enrijecidos",
      "Peso ou dores na região da cabeça"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Alterações Digestivas",
     "chave": "neg_fis_digestivas",
     "desc": "\"Quando as sensações corporais se manifestam na região do estomago e abdômen, ou interferem em nosso sistema digestivo ou apetite.\"",
     "itens": [
      "Boca seca ou salivação alterada",
      "Enjoo, náuseas ou desconfortos abdominais",
      "Alterações no apetite (comer mais ou menos)",
      "Intestino alterado (diarreia ou prisão de ventre)",
      "Estômago embrulhado ou irritado (queimação – azia)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Alterações no Sono e Concentração",
     "chave": "neg_fis_sono",
     "desc": "\"Quando as sensações corporais interferem nossa percepção da realidade, estado de alerta, atenção, sono e vigília.\"",
     "itens": [
      "Dificuldades para dormir",
      "Dificuldades de concentração",
      "Despertares noturnos ou muito cedo",
      "Confusão mental (dissossiação e/ou despersonalização)",
      "Mente acelerada (dificuldades para desligar – pensamentos intrusivos)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": [
    "Nenhum",
    "Pouco",
    "Moderado",
    "Muito",
    "Extremo"
   ],
   "rotulo": "Mal-estar:"
  },
  "pens": {
   "nome": "Pensamentos Desadaptativos",
   "grupos": [
    {
     "n": 1,
     "titulo": "Pensamentos sobre Mim Mesmo (Autocrítica)",
     "chave": "neg_pens_sobre_mim",
     "desc": "\"Quando meus pensamentos são duros comigo mesmo.\"",
     "itens": [
      "\"Não sou bom o bastante ou suficiente\"",
      "\"Não sou digno de ser amado ou valorizado\"",
      "\"Sou problemático: há algo de errado comigo\"",
      "\"Sou fracasso e não consigo lidar com as coisas\"",
      "\"Sou uma farsa: me vejo incapaz ou incompetente\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Pensamentos sobre o Futuro",
     "chave": "neg_pens_sobre_futuro",
     "desc": "\"Quando minha mente antecipa o pior cenário.\"",
     "itens": [
      "\"E se tudo der errado comigo?\"",
      "\"Algo terrível poderá acontecer\"",
      "\"Não serei capaz de lidar com isso\"",
      "\"Nunca vou melhorar ou sair dessa situação\"",
      "\"O futuro é desesperador ou sem esperança\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Pensamentos sobre os Outros",
     "chave": "neg_pens_sobre_outros",
     "desc": "\"Quando interpreto as intenções dos outros de forma negativa.\"",
     "itens": [
      "\"Não posso confiar nas outras pessoas\"",
      "\"Ninguém se importa comigo de verdade\"",
      "\"As pessoas me julgam ou não gostam de mim\"",
      "\"Estou sendo usado ou explorado pelos outros\"",
      "\"Estão sendo injustos comigo ou me desrespeitando\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Pensamentos de Cobrança",
     "chave": "neg_pens_cobranca",
     "desc": "\"Quando me cobro ou cobro os outros com regras inflexíveis.\"",
     "itens": [
      "\"Não posso errar ou falhar\"",
      "\"Eu deveria dar conta de tudo\"",
      "\"Eu precisava ser mais forte ou melhor\"",
      "\"As pessoas deveriam agir de outra forma\"",
      "\"Se não estiver perfeito, então não valerá a pena\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Pensamentos de Culpa / Autocondenação",
     "chave": "neg_pens_culpa",
     "desc": "\"Quando me responsabilizo excessivamente.\"",
     "itens": [
      "\"Eu não deveria ter feito ou dito aquilo\"",
      "\"Mereço o que está acontecendo comigo\"",
      "\"A culpa é minha, sou responsável por isso\"",
      "\"Decepcionei, desapontei ou magoei as pessoas\"",
      "\"Se souberem quem eu realmente sou vão me rejeitar\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": [
    "Nada",
    "Pouco",
    "Moderado",
    "Muito",
    "Totalmente"
   ],
   "rotulo": "Acredito:"
  },
  "comp": {
   "nome": "Comportamentos Disfuncionais",
   "grupos": [
    {
     "n": 1,
     "titulo": "Evitação / Fuga",
     "chave": "neg_comp_evitacao",
     "desc": "\"Quando tentamos nos afastar daquilo que nos causa desconforto.\"",
     "itens": [
      "Saí ou fugi de situações ou lugares",
      "Cancelei compromissos e obrigações",
      "Não respondi as mensagens ou ligações",
      "Procrastinei ou adiei tarefas importantes",
      "Evitei pessoas e/ou me expor às interações"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Isolamento / Retraimento",
     "chave": "neg_comp_isolamento",
     "desc": "\"Quando nos retraimos ou nos fechamos em nós mesmos.\"",
     "itens": [
      "Fiquei em silêncio ou me resguardei",
      "Me afastei das pessoas ou evitei o contato",
      "Aceitei passivamente as situações que incomodam",
      "Deixei de fazer atividades que antes eram prazerosas",
      "Tive dificuldades para iniciar ou manter minhas obrigações"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Agitação / Reatividade",
     "chave": "neg_comp_reatividade",
     "desc": "\"Quando agimos de forma impulsiva ou explosiva.\"",
     "itens": [
      "Critiquei ou ataquei verbalmente alguém",
      "Discuti, gritei, briguei ou busquei o conflito",
      "Bati, quebrei ou arremessei coisas e objetos",
      "Agi impulsivamente sem pensar nas consequências",
      "Fui agressivo e/ou me expus a riscos desnecessários"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Entorpecimento / Fuga emocional",
     "chave": "neg_comp_entorpecimento",
     "desc": "\"Quando buscamos aliviar ou anestesiar o que sentimos.\"",
     "itens": [
      "Comi em excesso ou compulsivamente",
      "Dormi em excesso para \"fugir\" do que senti",
      "Fiz compras impulsivas ou gastos excessivos",
      "Uso de álcool ou drogas para lidar com emoções",
      "Uso excessivo de telas (internet, redes sociais, TV)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Busca excessiva de controle / Reasseguramento",
     "chave": "neg_comp_controle",
     "desc": "\"Quando tentamos controlar tudo ou buscamos aprovação.\"",
     "itens": [
      "Tentei ser perfeito ou controlar cada detalhe",
      "Busquei por afirmação e/ou validação emocional",
      "Fiz verificações repetidas em busca de segurança",
      "Queixei-me ou reclamei repetidamente do problema",
      "Ruminei o problema: \"mastiguei\" mentalmente o ocorrido"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": null,
   "rotulo": null
  }
 },
 "pos": {
  "sit": {
   "nome": "Situação",
   "grupos": [],
   "legenda": null,
   "rotulo": null
  },
  "emo": {
   "nome": "Emoções Agradáveis",
   "grupos": [
    {
     "n": 1,
     "titulo": "Felicidade / Satisfação",
     "chave": "pos_emo_felicidade",
     "desc": "\"Quando nos sentimos bem com o momento presente.\"",
     "itens": [
      "Alegre",
      "Contente",
      "Divertido(a)",
      "Satisfeito(a)",
      "Entusiasmado(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Orgulho / Realização",
     "chave": "pos_emo_orgulho",
     "desc": "\"Quando reconhecemos nossas capacidades e conquistas.\"",
     "itens": [
      "Confiante",
      "Realizado(a)",
      "Orgulhoso(a)",
      "Determinado(a)",
      "Empoderado(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Conexão / Afeto",
     "chave": "pos_emo_conexao",
     "desc": "\"Quando nos sentimos próximos e ligados a outras pessoas.\"",
     "itens": [
      "Grato(a)",
      "Amoroso(a)",
      "Acolhido(a)",
      "Afetuoso(a)",
      "Compassivo(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Calma / Serenidade",
     "chave": "pos_emo_calma",
     "desc": "\"Quando experimentamos tranquilidade interior e paz.\"",
     "itens": [
      "Calmo(a)",
      "Sereno(a)",
      "Seguro(a)",
      "Aliviado(a)",
      "Tranquilo(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Esperança / Motivação",
     "chave": "pos_emo_esperanca",
     "desc": "\"Quando olhamos para o futuro com confiança.\"",
     "itens": [
      "Otimista",
      "Curioso(a)",
      "Motivado(a)",
      "Inspirado(a)",
      "Esperançoso(a)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": [
    "Nenhum",
    "Pouco",
    "Moderado",
    "Muito",
    "Intenso"
   ],
   "rotulo": "Conforto:"
  },
  "fis": {
   "nome": "Reações Físicas de Bem-Estar",
   "grupos": [
    {
     "n": 1,
     "titulo": "Desaceleração / Calma",
     "chave": "pos_fis_calma",
     "desc": "\"Quando o corpo desacelera de forma agradável.\"",
     "itens": [
      "Frequência cardíaca regular",
      "Respiração lenta e profunda",
      "Ausência de tremores ou sudorese",
      "Consciência corporal de conforto e segurança",
      "Sensação de equilíbrio e estabilidade corporal"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Energia / Vitalidade",
     "chave": "pos_fis_energia",
     "desc": "\"Quando o corpo se sente ativo e com vigor.\"",
     "itens": [
      "Energia e disposição física",
      "Motivação para realizar atividades",
      "Sensação de estar pleno e revigorado",
      "Percepções corpóreas de força e vitalidade",
      "Mente alerta e consciência plena dos movimentos"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Relaxamento / Soltura",
     "chave": "pos_fis_relaxamento",
     "desc": "\"Quando os músculos e o corpo se soltam.\"",
     "itens": [
      "Musculatura distensionada",
      "Ombros e pescoço relaxados",
      "Sensação de leveza na cabeça",
      "Mãos e mandíbula descontraídos",
      "Peito aberto e respiração confortável"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Conforto Digestivo",
     "chave": "pos_fis_digestivo",
     "desc": "\"Quando a região do estômago está confortável.\"",
     "itens": [
      "Boca hidratada",
      "Apetite regular e equilibrado",
      "Digestão tranquila e confortável",
      "Funcionamento intestinal regular",
      "Estômago calmo e sem desconforto"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Atenção / Descanso",
     "chave": "pos_fis_atencao",
     "desc": "\"Quando a mente está desperta e o corpo descansado.\"",
     "itens": [
      "Mente tranquila e desperta",
      "Sono reparador e restaurador",
      "Atenção e foco no momento presente",
      "Concentração e raciocínio preservados",
      "Lucidez e organização nos pensamentos"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": [
    "Nenhum",
    "Pouco",
    "Moderado",
    "Muito",
    "Extremo"
   ],
   "rotulo": "Bem-estar:"
  },
  "pens": {
   "nome": "Pensamentos Adaptativos",
   "grupos": [
    {
     "n": 1,
     "titulo": "Autocompaixão",
     "chave": "pos_pens_autocompaixao",
     "desc": "\"Quando consigo ser gentil comigo mesmo.\"",
     "itens": [
      "\"Mereço cuidar de mim\"",
      "\"Errar faz parte de ser humano\"",
      "\"Tenho qualidades e pontos fortes\"",
      "\"Posso aprender com esta experiência\"",
      "\"Estou fazendo o melhor que posso neste momento\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Esperança / Perspectiva",
     "chave": "pos_pens_esperanca",
     "desc": "\"Quando consigo ver além do momento difícil.\"",
     "itens": [
      "\"O futuro ainda está aberto\"",
      "\"Isso é temporário — vai passar\"",
      "\"Posso dar um passo de cada vez\"",
      "\"Já enfrentei coisas difíceis antes e superei\"",
      "\"Existem coisas que posso fazer para melhorar\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Confiança nos Outros",
     "chave": "pos_pens_confianca",
     "desc": "\"Quando consigo considerar as intenções dos outros de forma equilibrada.\"",
     "itens": [
      "\"Posso dar o benefício da dúvida\"",
      "\"Posso pedir ajuda sem ser um fardo\"",
      "\"Existem pessoas que se importam comigo\"",
      "\"Talvez a pessoa não tenha tido a intenção de me magoar\"",
      "\"Nem tudo é sobre mim — as pessoas têm seus próprios problemas\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Flexibilidade / Equilíbrio",
     "chave": "pos_pens_flexibilidade",
     "desc": "\"Quando consigo substituir regras rígidas por expectativas realistas.\"",
     "itens": [
      "\"Nem tudo depende de mim\"",
      "\"Bom o suficiente também é bom\"",
      "\"As pessoas são diferentes — e tudo bem\"",
      "\"Posso aceitar o que não está no meu controle\"",
      "\"Posso fazer o meu melhor sem exigir perfeição\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Responsabilidade Equilibrada",
     "chave": "pos_pens_responsabilidade",
     "desc": "\"Quando consigo avaliar minha responsabilidade de forma justa.\"",
     "itens": [
      "\"Posso reparar sem me destruir\"",
      "\"Um erro não define quem eu sou\"",
      "\"A responsabilidade é compartilhada\"",
      "\"Posso me perdoar e seguir em frente\"",
      "\"Fiz o que pude com o que sabia na época\""
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": [
    "Nada",
    "Pouco",
    "Moderado",
    "Muito",
    "Totalmente"
   ],
   "rotulo": "Acredito:"
  },
  "comp": {
   "nome": "Comportamentos Funcionais",
   "grupos": [
    {
     "n": 1,
     "titulo": "Enfrentamento / Ação",
     "chave": "pos_comp_enfrentamento",
     "desc": "\"Quando escolhemos lidar com a situação de frente.\"",
     "itens": [
      "Resolver um problema pendente",
      "Pedir ajuda ou buscar informação",
      "Cumprir uma tarefa mesmo sem vontade",
      "Tomar uma decisão que estava adiando",
      "Enfrentar uma situação que vinha evitando"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 2,
     "titulo": "Conexão / Vínculo",
     "chave": "pos_comp_conexao",
     "desc": "\"Quando nos aproximamos das pessoas.\"",
     "itens": [
      "Pedir ou oferecer ajuda",
      "Participar de uma atividade em grupo",
      "Aceitar ou propor um encontro social",
      "Demonstrar afeto ou carinho a alguém",
      "Conversar com alguém de confiança sobre como me sinto"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 3,
     "titulo": "Expressão / Comunicação",
     "chave": "pos_comp_expressao",
     "desc": "\"Quando expressamos o que sentimos de forma assertiva.\"",
     "itens": [
      "Ouvir o outro antes de responder",
      "Dizer \"não\" quando necessário",
      "Conversar para resolver um conflito",
      "Expressar um incômodo de forma assertiva",
      "Escrever sobre o que estou sentindo (diário, registro)"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 4,
     "titulo": "Autocuidado / Regulação",
     "chave": "pos_comp_autocuidado",
     "desc": "\"Quando cuidamos de nós mesmos de forma saudável.\"",
     "itens": [
      "Alimentar-se de forma equilibrada",
      "Manter uma rotina de sono adequada",
      "Praticar atividade física ou exercício",
      "Dedicar tempo a algo prazeroso ou relaxante",
      "Praticar técnicas de relaxamento, respiração ou meditação"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    },
    {
     "n": 5,
     "titulo": "Aceitação / Flexibilidade",
     "chave": "pos_comp_aceitacao",
     "desc": "\"Quando reconhecemos o que não podemos mudar.\"",
     "itens": [
      "Permitir-se ser imperfeito",
      "Reconhecer o que está fora do meu controle",
      "Aceitar uma emoção difícil sem tentar eliminá-la",
      "Praticar gratidão ou valorizar algo positivo no dia",
      "Agir de acordo com meus valores mesmo com desconforto"
     ],
     "outro": "Outro:",
     "outroDica": "especifique..."
    }
   ],
   "legenda": null,
   "rotulo": null
  }
 }
};
export const textos = {
 "humorNomes": [
  "Muito mal",
  "Mal",
  "Mais ou menos",
  "Bem",
  "Muito bem"
 ],
 "humorDesc": [
  "Estou me sentindo muito mal — com grande sofrimento ou desconforto emocional.",
  "Estou me sentindo mal — algo me incomoda e está afetando o meu dia.",
  "Não estou me sentindo bem nem mal — estou em um estado emocional estável.",
  "Estou me sentindo bem — com disposição e alguma satisfação.",
  "Estou me sentindo muito bem — com energia, leveza ou alegria."
 ],
 "tipos": {
  "neg": "Situações conflituosas → emoções desagradáveis, pensamentos desadaptativos e comportamentos disfuncionais",
  "pos": "Situações conflituosas ou harmoniosas → emoções agradáveis, pensamentos adaptativos e comportamentos funcionais"
 },
 "ajuda": {
  "titulo": "Precisa de ajuda? Veja perguntas que podem guiar sua reflexão",
  "intro": "Dependendo da emoção que você sentiu, algumas perguntas podem ajudar a identificar o pensamento por trás dela:",
  "itens": [
   {
    "emo": "Tristeza / Depressão",
    "perguntas": [
     "\"O que isso significa sobre mim?\"",
     "\"O que isso diz sobre minha vida ou meu futuro?\""
    ]
   },
   {
    "emo": "Ansiedade / Medo",
    "perguntas": [
     "\"O que temo que possa acontecer?\"",
     "\"Qual a pior coisa que poderia acontecer?\""
    ]
   },
   {
    "emo": "Raiva / Irritação",
    "perguntas": [
     "\"Fui tratado de forma injusta ou desrespeitosa?\"",
     "\"O que isso diz sobre essa pessoa ou as pessoas em geral?\""
    ]
   },
   {
    "emo": "Culpa / Vergonha",
    "perguntas": [
     "\"Fiz algo errado ou magoei alguém?\"",
     "\"O que penso sobre mim por ter feito ou sentido isso?\""
    ]
   },
   {
    "emo": "Ciúme / Inveja",
    "perguntas": [
     "\"O que temo perder ou que está ameaçado?\"",
     "\"O que penso sobre mim quando me comparo com outra pessoa?\""
    ]
   }
  ]
 },
 "etapaTitulo": {
  "sit": "O que aconteceu?",
  "emo": "O que você sentiu?",
  "fis": "O que você sentiu no corpo?",
  "pens": "Quais pensamentos passaram pela sua mente?",
  "comp": "Como você reagiu a essa situação?"
 },
 "instrucao": {
  "neg": {
   "sit": "O que estava acontecendo quando seu humor mudou",
   "emo": "Identifique as emoções desagradáveis e avalie a intensidade do desconforto",
   "fis": "Identifique as sensações corporais de mal-estar e avalie sua intensidade",
   "pens": "Identifique pensamentos desadaptativos e avalie o quanto você acredita nesses pensamentos",
   "comp": "Identifique seus comportamentos disfuncionais que pioraram a situação"
  },
  "pos": {
   "sit": "O que estava acontecendo quando seu humor mudou",
   "emo": "Identifique as emoções agradáveis e avalie a intensidade de conforto",
   "fis": "Identifique as sensações corporais de bem-estar e avalie a intensidade",
   "pens": "Identifique pensamentos adaptativos e avalie o quanto você acredita nesses pensamentos",
   "comp": "Identifique seus comportamentos funcionais que ajudaram a situação"
  }
 },
 "tipoRotulo": {
  "sit": "Tipo de Contexto",
  "pens": "Tipo de Pensamento",
  "comp": "Tipo de Comportamento"
 },
 "tipoFrase": {
  "neg": {
   "sit": "Marque os tipos de situação que desencadearam alterações no seu humor.",
   "pens": "Marque os tipos de pensamento desadaptativo que passaram pela sua cabeça.",
   "comp": "Marque os tipos de comportamento disfuncional que você teve nessa situação."
  },
  "pos": {
   "pens": "Marque os tipos de pensamento adaptativo que passaram pela sua cabeça.",
   "comp": "Marque os tipos de comportamento funcional que você teve nessa situação."
  }
 },
 "dica": {
  "sit": "Ex: Quando isso aconteceu? Onde você estava? Com quem você estava? O que você estava fazendo?",
  "sitComObs": "Ex.: o fato ou a conversa que mexeu com você.",
  "pens": "O que estava passando pela minha mente instantes antes de eu começar a me sentir assim? Que imagens ou lembranças tenho nesta situação?",
  "comp": "O que você fez nessa situação? Como você agiu ou reagiu diante disso?"
 },
 "obrigatorio": {
  "sitTexto": "Preencha o campo \"O que aconteceu?\" antes de avançar.",
  "sitGrupo": "Marque pelo menos uma opção em algum tipo de contexto antes de avançar.",
  "pensTexto": "Descreva pelo menos um pensamento na caixa de texto antes de avançar.",
  "compTexto": "Descreva como você reagiu na caixa de texto antes de avançar.",
  "compGrupo": "Marque pelo menos uma opção em algum tipo de comportamento antes de avançar.",
  "grupo": "Marque pelo menos um item em algum grupo desta seção antes de avançar."
 },
 "addPensamento": "+ Adicionar outro pensamento"
};
