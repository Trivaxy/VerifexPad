FROM mcr.microsoft.com/dotnet/sdk:9.0-noble

WORKDIR /app

# Install dependencies required for Z3 and Git
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Download and install Z3 4.12.2 native libraries
RUN wget https://github.com/Z3Prover/z3/releases/download/z3-4.12.2/z3-4.12.2-x64-glibc-2.31.zip -O z3.zip \
    && unzip z3.zip \
    && cp z3-4.12.2-x64-glibc-2.31/bin/libz3.so /usr/lib/ \
    && cp -r z3-4.12.2-x64-glibc-2.31/include/* /usr/include/ \
    && rm -rf z3.zip z3-4.12.2-x64-glibc-2.31

# Clone the Verifex compiler repository
# Use ARG to make it easy to update the version or branch
ARG VERIFEX_VERSION=master
RUN git clone https://github.com/Trivaxy/Verifex.git --branch ${VERIFEX_VERSION} --depth 1

# Build the project with runtime configuration
RUN dotnet build /app/Verifex/Verifex.csproj -c Debug
RUN dotnet publish /app/Verifex/Verifex.csproj -c Debug -o /app/publish

WORKDIR /app

# Copy the Z3 library to the publish directory to ensure it's available
RUN cp /usr/lib/libz3.so /app/publish/

# Create a runtime configuration file
RUN echo '{                                           \
  "runtimeOptions": {                                 \
    "tfm": "net9.0",                                  \
    "framework": {                                    \
      "name": "Microsoft.NETCore.App",                \
      "version": "9.0.0"                              \
    }                                                 \
  }                                                   \
}' > /app/publish/Verifex.runtimeconfig.json

# Create a directory for code execution
RUN mkdir -p /tmp/code
RUN chmod 777 /tmp/code

# Set the working directory for code execution
WORKDIR /tmp/code

# Create a non-root user for running the compiler
RUN useradd -m verifexuser
RUN chown -R verifexuser:verifexuser /tmp/code

# Make sure the verifexuser can create executables
RUN mkdir -p /app/.dotnet
RUN chown -R verifexuser:verifexuser /app
RUN ldconfig

# Set environment variable to help .NET find the native library
ENV LD_LIBRARY_PATH=/app/publish:/usr/lib

# Switch to non-root user for better security
USER verifexuser

# Define the entry point to run Verifex compiler
ENTRYPOINT ["dotnet", "/app/publish/Verifex.dll"]