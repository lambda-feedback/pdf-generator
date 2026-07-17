# PDF generator

## Setting Up

### Dependencies

- Docker
- Node ^20.12.2
- yarn
- AWS credentials

\*Last updated 2024/04/22

### Starting the server

- create a `.env` file based on the `.env.example` file. Ask a developer on the specific configuration
- run `yarn install` to install `node_modules`
- run `docker build -t lambda-with-pandoc .` to build 
- run `docker run --env-file .env  -p 9000:8080 lambda-with-pandoc` run the docker containers

### Calling the server

## Using curl

```bash
curl --location 'http://localhost:9000/2015-03-31/functions/function/invocations' --header 'Content-Type: application/json' --data '{ "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6", "fileName": "my_set_pdf", "typeOfFile":"PDF", "markdown":"hi from local"}'
```

## From postman

POST url:
```bash
http://localhost:9000/2015-03-31/functions/function/invocations
```

body:
```json
[
    {
        "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6",
        "fileName": "pokus_pdf",
        "typeOfFile":"PDF",
        "markdown":"hi from postman staging pdf"
    },
    {
        "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6",
        "fileName": "pokus_tex",
        "typeOfFile":"TEX",
        "markdown":"hi from postman staging tex"
    }
]
```

### Request fields

| Field | Required | Description |
|---|---|---|
| `userId` | Yes | Used to namespace the generated file in S3 |
| `fileName` | Yes | Output file name, without extension |
| `typeOfFile` | Yes | `"PDF"` or `"TEX"` |
| `markdown` | Yes | Source document body |
| `implicitFigures` | No | Enables Pandoc's `implicit_figures` extension |
| `variables` | No | Map of Pandoc template variables, passed as `--variable=key:value` |
| `template` | No | `"default"` or `"cjk"` (see below). Defaults to `"default"` |

### Templates

Two LaTeX templates are available via the `template` field:

- `"default"` (default) — the standard document template, sans-serif `lmodern` font.
- `"cjk"` — adds `xeCJK` support for Chinese/Japanese/Korean typesetting, with `Noto Sans` / `Noto Sans CJK KR` as the default fonts. Use this when the document contains CJK text. `mainfont`/`CJKmainfont` can still be overridden via `variables`.

```json
[
    {
        "userId":"c82da7d4-3295-4c4a-921b-7000d65224b6",
        "fileName": "korean_doc",
        "typeOfFile":"PDF",
        "template":"cjk",
        "markdown":"# 수학 문서\n\n이차 방정식의 판별식은 $\\Delta = b^2 - 4ac$ 입니다."
    }
]
```


## Testing

### Dependencies

In addition to the runtime dependencies above, running the full test suite locally requires:

- [Pandoc](https://pandoc.org/installing.html) — for integration tests that verify markdown → LaTeX conversion
- A TeX Live distribution with **xelatex** — for compile tests that produce real PDFs
- [poppler-utils](https://poppler.freedesktop.org/) (`pdftotext`) — for content verification of compiled PDFs

On macOS these can be installed via Homebrew:
```bash
brew install pandoc mactex poppler
brew install --cask font-noto-sans font-noto-sans-cjk
```

### Running tests

```bash
yarn test          # type-check + all tests
yarn test:unit     # unit and integration tests only
yarn test:types    # TypeScript type-check only
```

### Test structure

| File | Type | What it tests |
|---|---|---|
| `src/utils.test.ts` | Unit | `fixInlineLatex`, `errorRefiner`, `deleteFile` — pure function logic |
| `index.test.ts` | Unit | Zod schema validation and Lambda handler routing (Pandoc mocked) |
| `src/pandoc.test.ts` | Integration | Real Pandoc: markdown → LaTeX fragment output, math, `implicit_figures`, Unicode |
| `src/compile.test.ts` | End-to-end | Full pipeline: Pandoc + `template.latex` + xelatex → PDF; content verified with `pdftotext` |

The compile tests take ~5–15 seconds each as they invoke xelatex.

## More information

https://github.com/lambda-feedback/technical-documentation/blob/main/docs/pdf_generator/index.md
