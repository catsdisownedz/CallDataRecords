FROM quay.io/keycloak/keycloak:24.0.2

# Copy your local themes folder into the Keycloak themes directory
COPY themes/cdr-pastel /opt/keycloak/themes/cdr-pastel
