# Stage 1: Build TypeScript code and install Pandoc
FROM public.ecr.aws/lambda/nodejs:20 as builder

# Install tar and gzip
RUN dnf install -y tar gzip

# Download and install Pandoc
RUN curl -fsSL https://github.com/jgm/pandoc/releases/download/3.1.13/pandoc-3.1.13-linux-amd64.tar.gz -o /tmp/pandoc.tar.gz \
  && tar -xzf /tmp/pandoc.tar.gz -C /tmp \
  && mv /tmp/pandoc-3.1.13/bin/pandoc /usr/bin \
  && rm -rf /tmp/pandoc.tar.gz /tmp/pandoc-3.1.13

RUN chmod +x /usr/bin/pandoc

# Copy package.json and install dependencies
WORKDIR /usr/app
COPY package.json package-lock.json ./
RUN npm install

# Copy and build TypeScript code
COPY tsconfig.json ./
COPY src/ ./src
COPY index.ts index.ts
RUN npm run build

# Stage 2: Final image
FROM public.ecr.aws/lambda/nodejs:20

# Install Latex environment and dependencies
RUN dnf install -y \
  texlive-collection-latexrecommended.noarch \
  texlive-iftex.noarch

# Copy built files from previous stage
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/bin/pandoc /usr/bin/pandoc
COPY --from=builder /usr/app/src/template.latex template.latex

RUN chmod +x /usr/bin/pandoc

# Set the Lambda function handler
CMD ["index.handler"]