import { Card, CardContent } from "../components/ui/card";
import { Shield, Mail, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";

export default function LegalPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0c10] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-[#ff3300]/20">
              <Shield className="w-8 h-8 text-[#ff3300]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Información Legal</h1>
              <p className="text-slate-400">Aviso de Privacidad</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-8 prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold text-white mb-6">AVISO DE PRIVACIDAD</h2>
            
            <p className="text-lg text-[#ff3300] font-semibold mb-4">
              Leaderlix (Digital Business, Coaching and Marketing Services LLC)
            </p>
            
            <div className="flex items-center gap-2 text-slate-400 mb-8">
              <MapPin className="w-4 h-4" />
              <span>10601 Clarence Dr., Suite 250, Frisco, TX 75033, Estados Unidos</span>
            </div>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">1. Introducción</h3>
              <p className="text-slate-300 leading-relaxed">
                En Leaderlix (Digital Business, Coaching and Marketing Services LLC), respetamos y protegemos la privacidad de nuestros usuarios y clientes. Este Aviso de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos tu información personal, así como tus derechos relacionados con dicha información. Cumplimos con todas las leyes y regulaciones aplicables en materia de protección de datos, incluyendo el Reglamento General de Protección de Datos (GDPR) de la Unión Europea y la Ley de Privacidad del Consumidor de California (CCPA).
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">2. Responsable del Tratamiento de Datos Personales</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Leaderlix (Digital Business, Coaching and Marketing Services LLC) es el responsable del tratamiento de tus datos personales. Puedes contactarnos en:
              </p>
              <div className="bg-[#0a0a0a] p-4 rounded-lg border border-[#222]">
                <div className="flex items-center gap-2 text-slate-300 mb-2">
                  <Mail className="w-4 h-4 text-[#ff3300]" />
                  <span>contact@leaderlix.com</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-[#ff3300]" />
                  <span>10601 Clarence Dr., Suite 250, Frisco, TX 75033, Estados Unidos</span>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">3. Datos Personales Recopilados</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Podemos recopilar y procesar los siguientes datos personales:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                <li><strong className="text-white">Nombre:</strong> Para personalizar nuestra comunicación por correo electrónico.</li>
                <li><strong className="text-white">Correo Electrónico:</strong> Para enviarte mensajes con fines comerciales y de atención al cliente.</li>
                <li><strong className="text-white">Teléfono:</strong> Para realizar llamadas, enviar mensajes de texto y mensajes por WhatsApp con fines comerciales y de atención al cliente.</li>
                <li><strong className="text-white">Dirección Postal:</strong> Para enviar material promocional y correspondencia.</li>
                <li><strong className="text-white">Información de Pago:</strong> Para procesar tus pagos a través de nuestros procesadores de pago, Stripe y PayPal. No almacenamos ni tenemos acceso a tu información de pago completa.</li>
                <li><strong className="text-white">Historial de Compras y Transacciones:</strong> Para gestionar tu cuenta y proporcionarte un mejor servicio.</li>
                <li><strong className="text-white">Grabaciones de Llamadas:</strong> Para fines de calidad y capacitación. No compartimos estas grabaciones con terceros fuera de Leaderlix.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">4. Finalidades del Tratamiento de Datos</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Tus datos personales son tratados para las siguientes finalidades:
              </p>
              
              <h4 className="text-lg font-medium text-white mb-2">Finalidades Primarias:</h4>
              <ul className="list-disc list-inside text-slate-300 space-y-1 ml-4 mb-4">
                <li>Proveer los servicios y productos que has solicitado.</li>
                <li>Personalizar nuestra comunicación contigo.</li>
                <li>Gestionar y mejorar nuestra relación comercial y de atención al cliente.</li>
                <li>Procesar pagos y gestionar transacciones financieras.</li>
                <li>Realizar encuestas de satisfacción y estudios de mercado.</li>
              </ul>

              <h4 className="text-lg font-medium text-white mb-2">Finalidades Secundarias:</h4>
              <ul className="list-disc list-inside text-slate-300 space-y-1 ml-4">
                <li>Enviar material promocional y publicitario.</li>
                <li>Invitarte a eventos y webinars.</li>
                <li>Realizar análisis estadísticos y de comportamiento.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">5. Compartición de Datos Personales</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Leaderlix no vende, alquila ni comparte tus datos personales con terceros para sus propios fines comerciales. Sin embargo, podemos compartir tus datos personales con:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                <li><strong className="text-white">Proveedores de Servicios:</strong> Que nos ayudan a operar nuestro negocio, como procesadores de pago, servicios de marketing y plataformas de email.</li>
                <li><strong className="text-white">Autoridades Gubernamentales:</strong> Cuando sea requerido por ley o para cumplir con un proceso legal válido.</li>
                <li><strong className="text-white">Auditores y Asesores:</strong> Para cumplir con nuestras obligaciones legales y contractuales.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">6. Transferencias Internacionales de Datos</h3>
              <p className="text-slate-300 leading-relaxed">
                Tus datos personales pueden ser transferidos y procesados en países fuera de tu país de residencia, incluyendo los Estados Unidos, donde las leyes de protección de datos pueden ser diferentes. Al proporcionar tus datos personales, consientes estas transferencias internacionales de datos.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">7. Derechos de los Titulares de Datos</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Tienes los siguientes derechos en relación con tus datos personales:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                <li><strong className="text-white">Derecho de Acceso:</strong> Puedes solicitar acceso a los datos personales que tenemos sobre ti.</li>
                <li><strong className="text-white">Derecho de Rectificación:</strong> Puedes solicitar la corrección de datos personales inexactos o incompletos.</li>
                <li><strong className="text-white">Derecho de Eliminación:</strong> Puedes solicitar la eliminación de tus datos personales, sujeto a ciertas excepciones legales.</li>
                <li><strong className="text-white">Derecho a la Portabilidad de los Datos:</strong> Puedes solicitar que te proporcionemos tus datos personales en un formato estructurado, de uso común y legible por máquina.</li>
                <li><strong className="text-white">Derecho a Oponerte al Tratamiento:</strong> Puedes oponerte al tratamiento de tus datos personales en determinadas circunstancias.</li>
                <li><strong className="text-white">Derecho a Retirar el Consentimiento:</strong> Puedes retirar tu consentimiento en cualquier momento, sin que esto afecte la legalidad del tratamiento basado en el consentimiento previo a su retirada.</li>
              </ul>
              <p className="text-slate-300 leading-relaxed mt-4">
                Para ejercer estos derechos, por favor contacta a nuestro Oficial de Protección de Datos en <span className="text-[#ff3300]">contact@leaderlix.com</span>. Te responderemos en un plazo no mayor a 5 días hábiles.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">8. Seguridad de la Información</h3>
              <p className="text-slate-300 leading-relaxed">
                Implementamos medidas de seguridad técnicas y organizativas adecuadas para proteger tus datos personales contra el acceso no autorizado, la alteración, divulgación o destrucción de la información.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">9. Conservación de los Datos</h3>
              <p className="text-slate-300 leading-relaxed">
                Conservamos tus datos personales únicamente durante el tiempo necesario para cumplir con las finalidades para las que fueron recopilados, a menos que la ley exija o permita un período de conservación más largo.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">10. Cookies y Tecnologías Similares</h3>
              <p className="text-slate-300 leading-relaxed">
                Utilizamos cookies y tecnologías similares para mejorar tu experiencia en nuestro sitio web, analizar el uso del sitio web y mostrar publicidad personalizada. Puedes gestionar tus preferencias de cookies a través de la configuración de tu navegador.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">11. Enlaces a Sitios de Terceros</h3>
              <p className="text-slate-300 leading-relaxed">
                Nuestro sitio web puede contener enlaces a sitios web de terceros. No somos responsables de las prácticas de privacidad ni del contenido de estos sitios web. Te recomendamos leer los avisos de privacidad de cada sitio que visitas.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-3">12. Cambios en el Aviso de Privacidad</h3>
              <p className="text-slate-300 leading-relaxed">
                Nos reservamos el derecho de actualizar este aviso de privacidad en cualquier momento. Cualquier cambio significativo se te notificará a través de nuestro sitio web o mediante correo electrónico.
              </p>
            </section>

            <section className="mb-4">
              <h3 className="text-xl font-semibold text-white mb-3">13. Contacto</h3>
              <p className="text-slate-300 leading-relaxed mb-4">
                Si tienes alguna pregunta o inquietud sobre este aviso de privacidad, puedes contactarnos en:
              </p>
              <div className="bg-[#0a0a0a] p-4 rounded-lg border border-[#222]">
                <div className="flex items-center gap-2 text-slate-300 mb-2">
                  <Mail className="w-4 h-4 text-[#ff3300]" />
                  <span>contact@leaderlix.com</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-[#ff3300]" />
                  <span>10601 Clarence Dr., Suite 250, Frisco, TX 75033, Estados Unidos</span>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          © {new Date().getFullYear()} Leaderlix. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
