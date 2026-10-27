import { CharacterValue } from '../types/character';
import { StoryDocument, StoryNode } from '../types/story';

// Personagem de exemplo que acompanha o sistema pré-configurado (Dungeons & Dragons 5e).
// Cada pessoa que cria uma conta recebe a sua própria cópia, que é um personagem comum:
// pode ser editado ou excluído como qualquer outro.
//
// Os valores usam a "chave" de cada atributo do sistema (e não o id, que é gerado na instalação).
// Ficha de uma maga de 5º nível; modificadores, bônus e espaços de magia seguem as regras da 5e.

export const EXAMPLE_SYSTEM_NAME_PREFIX = 'Dungeons & Dragons';
export const EXAMPLE_CHARACTER_NAME = 'Elara Vento Prateado';

export function exampleValues(playerName: string): Record<string, CharacterValue> {
  return {
    // Identificação
    classe_e_nivel: 'Maga 5',
    antecedente: 'Sábia',
    nome_do_jogador: playerName,
    raca: 'Elfa (Alto Elfo)',
    alinhamento: 'Neutro e Bom',
    pontos_de_experiencia: 6500,

    // Atributos (valor e modificador)
    inspiracao: false,
    bonus_de_proficiencia: 3,
    forca: 8, modificador_de_forca: -1,
    destreza: 14, modificador_de_destreza: 2,
    constituicao: 13, modificador_de_constituicao: 1,
    inteligencia: 17, modificador_de_inteligencia: 3,
    sabedoria: 12, modificador_de_sabedoria: 1,
    carisma: 10, modificador_de_carisma: 0,

    // Salvaguardas (proficiente em Inteligência e Sabedoria: modificador + 3)
    salvaguarda_de_forca: -1, proficiente_em_salvaguarda_de_forca: false,
    salvaguarda_de_destreza: 2, proficiente_em_salvaguarda_de_destreza: false,
    salvaguarda_de_constituicao: 1, proficiente_em_salvaguarda_de_constituicao: false,
    salvaguarda_de_inteligencia: 6, proficiente_em_salvaguarda_de_inteligencia: true,
    salvaguarda_de_sabedoria: 4, proficiente_em_salvaguarda_de_sabedoria: true,
    salvaguarda_de_carisma: 0, proficiente_em_salvaguarda_de_carisma: false,

    // Perícias (proficiente: modificador + 3)
    acrobacia_des: 2, proficiente_em_acrobacia: false,
    lidar_com_animais_sab: 1, proficiente_em_lidar_com_animais: false,
    arcanismo_int: 6, proficiente_em_arcanismo: true,
    atletismo_for: -1, proficiente_em_atletismo: false,
    atuacao_car: 0, proficiente_em_atuacao: false,
    enganacao_car: 0, proficiente_em_enganacao: false,
    furtividade_des: 2, proficiente_em_furtividade: false,
    historia_int: 6, proficiente_em_historia: true,
    intimidacao_car: 0, proficiente_em_intimidacao: false,
    intuicao_sab: 1, proficiente_em_intuicao: false,
    investigacao_int: 6, proficiente_em_investigacao: true,
    medicina_sab: 4, proficiente_em_medicina: true,
    natureza_int: 3, proficiente_em_natureza: false,
    percepcao_sab: 4, proficiente_em_percepcao: true,
    persuasao_car: 0, proficiente_em_persuasao: false,
    prestidigitacao_des: 2, proficiente_em_prestidigitacao: false,
    religiao_int: 3, proficiente_em_religiao: false,
    sobrevivencia_sab: 1, proficiente_em_sobrevivencia: false,
    sabedoria_passiva_percepcao: 14,

    // Combate
    classe_de_armadura: 12,
    iniciativa: 2,
    deslocamento: '9 m',
    pontos_de_vida_maximos: 27,
    pontos_de_vida_atuais: 27,
    pontos_de_vida_temporarios: 0,
    total_de_dados_de_vida: '5d6',
    dado_de_vida: '5d6',
    sucessos_de_salvaguarda_contra_a_morte: 0,
    falhas_de_salvaguarda_contra_a_morte: 0,

    // Ataques e conjuração
    ataque_1_nome: 'Raio de Fogo',
    ataque_1_bonus_de_ataque: 6,
    ataque_1_dano_tipo: '2d10 ígneo',
    ataque_2_nome: 'Adaga',
    ataque_2_bonus_de_ataque: 5,
    ataque_2_dano_tipo: '1d4 + 2 perfurante',
    ataque_3_nome: 'Bordão',
    ataque_3_bonus_de_ataque: 2,
    ataque_3_dano_tipo: '1d6 − 1 contundente',
    anotacoes_de_ataques_e_conjuracao:
      'Raio de Fogo alcança 36 m e causa mais dano a partir do 5º nível. Prefere magias a combate corpo a corpo; a adaga fica para emergências e o bordão serve de apoio nas viagens.',

    // Equipamento e moedas
    equipamento:
      'Bordão\nAdaga (2)\nGrimório de couro, com fecho de prata\nBolsa de componentes\nMochila de explorador (saco de dormir, rações para 10 dias, corda de seda de 15 m, pederneira e tochas)\nRoupas de viajante\nTinteiro de prata e um estojo de penas',
    pecas_de_cobre_pc: 12,
    pecas_de_prata_pp: 35,
    pecas_de_electro_pe: 0,
    pecas_de_ouro_po: 148,
    pecas_de_platina_pl: 2,

    // Personalidade
    tracos_de_personalidade:
      'Fala demais quando está nervosa e cita livros que ninguém leu. Anota tudo, até as conversas dos outros.',
    ideais: 'Conhecimento. O caminho para o poder e para o aperfeiçoamento está no conhecimento. (Neutro)',
    vinculos:
      'O grimório sem autor é a única herança que ela guarda da família. Jurou ao velho bibliotecário que recuperaria as páginas que faltam.',
    fraquezas: 'Não resiste a um livro proibido, nem quando sabe que é uma armadilha.',

    // Proficiências e características
    outras_proficiencias_e_idiomas:
      'Idiomas: Comum, Élfico, Dracônico e Anão.\nArmas: adagas, dardos, fundas, bordões e bestas leves.\nArmaduras e ferramentas: nenhuma.',
    caracteristicas_e_talentos:
      'Recuperação Arcana: uma vez por dia, em um descanso curto, recupera espaços de magia (até 3 níveis combinados).\nTradição Arcana, Escola de Evocação: Esculpir Magias, para proteger aliados dos próprios efeitos.\nAlto Elfo: Visão no Escuro (18 m), Sentidos Aguçados, Ancestral Feérico, Transe e um truque extra de mago.\nAntecedente Sábio: Pesquisador.',

    // Aparência
    idade: '127 anos',
    altura: '1,68 m',
    peso: '58 kg',
    cor_dos_olhos: 'Cinza-prata',
    cor_da_pele: 'Clara, com um leve brilho prateado',
    cor_do_cabelo: 'Azul-acinzentado',
    aparencia_do_personagem:
      'Esguia, de olhar atento e dedos manchados de tinta. Veste um manto de viagem azul-acinzentado, com bolsos costurados por dentro para esconder páginas e penas.',

    // Aliados, talentos e tesouros
    aliados_e_organizacoes:
      'Irmandade das Páginas Perdidas: rede de copistas e bibliotecários que troca notícias sobre manuscritos desaparecidos.\nOrrin, o velho bibliotecário que a criou como aprendiz.',
    nome_do_simbolo: 'Livro aberto sob a lua',
    caracteristicas_e_talentos_adicionais:
      'Copista treinada: reconhece a caligrafia de um escriba depois de ler poucas linhas.',
    tesouros:
      'O grimório sem autor (faltam onze páginas).\nUm tinteiro de prata que nunca seca.\nUma chave de ferro sem fechadura conhecida.',

    // Magias (mago de 5º nível: Inteligência; CD 8 + 3 + 3; ataque +3 + 3)
    atributo_de_conjuracao: 'Inteligência',
    classe_conjuradora: 'Mago',
    cd_para_evitar_suas_magias: 14,
    modificador_de_ataque_magico: 6,
    truques: 'Raio de Fogo\nMão Mágica\nLuz\nPrestidigitação\nProteção contra Lâminas',
    '1_circulo_total_de_espacos': 4, '1_circulo_espacos_utilizados': 0,
    '1_circulo_magias': 'Mísseis Mágicos\nEscudo Arcano\nArmadura Arcana\nDetectar Magia',
    '2_circulo_total_de_espacos': 3, '2_circulo_espacos_utilizados': 0,
    '2_circulo_magias': 'Passo Nebuloso\nInvisibilidade',
    '3_circulo_total_de_espacos': 2, '3_circulo_espacos_utilizados': 0,
    '3_circulo_magias': 'Bola de Fogo\nVoo',
    '4_circulo_total_de_espacos': 0, '4_circulo_espacos_utilizados': 0,
    '5_circulo_total_de_espacos': 0, '5_circulo_espacos_utilizados': 0,
    '6_circulo_total_de_espacos': 0, '6_circulo_espacos_utilizados': 0,
    '7_circulo_total_de_espacos': 0, '7_circulo_espacos_utilizados': 0,
    '8_circulo_total_de_espacos': 0, '8_circulo_espacos_utilizados': 0,
    '9_circulo_total_de_espacos': 0, '9_circulo_espacos_utilizados': 0,
  };
}

// ---- História de origem (mesmo formato do editor) ----
const text = (value: string, marks?: Array<'bold' | 'italic'>): StoryNode =>
  marks ? { type: 'text', text: value, marks: marks.map((type) => ({ type })) } : { type: 'text', text: value };
const paragraph = (...content: StoryNode[]): StoryNode => ({ type: 'paragraph', content });
const heading = (level: 1 | 2, value: string): StoryNode => ({ type: 'heading', attrs: { level }, content: [text(value)] });
const item = (...content: StoryNode[]): StoryNode => ({ type: 'listItem', content: [paragraph(...content)] });

export const EXAMPLE_STORY: StoryDocument = {
  type: 'doc',
  content: [
    heading(1, 'A Biblioteca de Valdoria'),
    paragraph(
      text('Elara nasceu no último inverno do reinado de Aldric, em uma cidade onde '),
      text('os livros valiam mais que o ouro', ['bold']),
      text(
        '. Filha de uma copista e de um cartógrafo, aprendeu a ler antes de aprender a andar, e passou a infância entre estantes, tinteiros e mapas ainda úmidos.',
      ),
    ),
    heading(2, 'O que a marcou'),
    {
      type: 'bulletList',
      content: [
        item(text('O incêndio da ala leste, aos nove anos, quando viu séculos de saber virarem fumaça')),
        item(text('Um grimório sem autor, que ela guarda até hoje', ['italic']), text(' e que parece escrever sozinho nas margens')),
        item(text('A promessa feita a Orrin, o velho bibliotecário que a ensinou a ler sem pressa')),
      ],
    },
    { type: 'blockquote', content: [paragraph(text('“Quem esquece o que leu, lê duas vezes o mesmo erro.”', ['italic']))] },
    { type: 'horizontalRule' },
    heading(2, 'Hoje'),
    paragraph(
      text(
        'Elara viaja de cidade em cidade em busca das páginas que faltam ao grimório, e de quem as arrancou. Leva consigo a adaga que Orrin lhe deu, um tinteiro que nunca seca e a certeza de que cada resposta que encontra abre duas perguntas novas.',
      ),
    ),
    paragraph(text('Esta história é um ponto de partida: pode mudar o nome, o passado e o destino de Elara como quiser.')),
  ],
};
