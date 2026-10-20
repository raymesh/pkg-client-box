// client-box · every word on the box, per language. A site picks one with lang: 'en' | 'es'.
// Examples are the tappable sentences in the how-to; keep them short and ordinary.
export const STRINGS = {
  en: {
    jobs: 'Small jobs', jobsHint: "Tick a job when it's done, ✎ to change its wording, × to delete it. It saves for both of us.",
    none: 'Nothing small open right now.', fromNotes: 'From notes', added: 'added', done: 'done',
    title: 'Add & update', intro: 'Jobs, changes, notes and photos, in your own words. We both see everything here. First time? Open <b>How to use this box</b>.',
    howto: 'How to use this box', tap: 'Tap an example to put it in the box, then change the words.',
    h: [
      { t: 'Add a job', d: 'Type it, then tap <b>Add as a small job</b>.', ex: ['Fix the bathroom door, it sticks when it rains'] },
      { t: 'Change, finish or delete a job', d: 'Say it like a message, tap <b>Tidy up</b>, check the changes, then <b>Save this</b>. You can also tap ✎ or × on the job itself.',
        ex: ["Change 'Return all items to the store' to 'Return the toilet parts to the store'", 'The shelf in the back room is done', 'Delete the job about the black paint'] },
      { t: 'Several things at once', d: 'Write them all together and tap <b>Tidy up</b>: it sorts new jobs, changes, questions and dates.',
        ex: ['The back room needs a shelf, about 4 ft, before Christmas. Can the lights be a bit warmer? The front sign light flickers.'] },
      { t: 'Leave a note', d: 'Ideas, questions, anything to remember: tap <b>Save as a note</b>.', ex: ['Ideas for the waiting room: plants and a round mirror'] },
      { t: 'Add photos', d: 'Tap <b>Add photos</b> to take a picture or pick some from your phone. They show up below for both of us.', ex: [] },
    ],
    placeholder: 'Write a job, a change, a question or a note…',
    tidy: 'Tidy up', addJob: 'Add as a small job', saveNote: 'Save as a note', addPhotos: 'Add photos',
    tidied: 'Tidied · check it, then save', changes: 'Changes to Small jobs', saveThis: 'Save this', keepEditing: 'Keep editing',
    yourNotes: 'Your notes', edit: 'Edit', photos: 'Photos',
  },
  es: {
    jobs: 'Pendientes', jobsHint: 'Marca un pendiente cuando esté hecho, ✎ para cambiar el texto, × para borrarlo. Se guarda para todos.',
    none: 'No hay pendientes ahora mismo.', fromNotes: 'De las notas', added: 'añadido', done: 'hecho',
    title: 'Añadir y actualizar', intro: 'Pendientes, cambios, notas y fotos, en tus palabras. Todos vemos lo mismo aquí. ¿Primera vez? Abre <b>Cómo usar esta caja</b>.',
    howto: 'Cómo usar esta caja', tap: 'Toca un ejemplo para ponerlo en la caja y cambia las palabras.',
    h: [
      { t: 'Añadir un pendiente', d: 'Escríbelo y toca <b>Añadir como pendiente</b>.', ex: ['Arreglar la puerta del baño, se pega cuando llueve'] },
      { t: 'Cambiar, terminar o borrar un pendiente', d: 'Dilo como un mensaje, toca <b>Ordenar</b>, revisa los cambios y luego <b>Guardar esto</b>. También puedes tocar ✎ o × en el pendiente.',
        ex: ["Cambia 'Devolver todo a la tienda' por 'Devolver las piezas del inodoro a la tienda'", 'La tablilla del cuarto de atrás ya está', 'Borra el pendiente de la pintura negra'] },
      { t: 'Varias cosas a la vez', d: 'Escríbelas juntas y toca <b>Ordenar</b>: separa pendientes nuevos, cambios, preguntas y fechas.',
        ex: ['El cuarto de atrás necesita una tablilla, como de 4 pies, antes de Navidad. ¿Las luces pueden ser más cálidas? La luz del letrero parpadea.'] },
      { t: 'Dejar una nota', d: 'Ideas, preguntas, lo que haya que recordar: toca <b>Guardar como nota</b>.', ex: ['Ideas para la sala de espera: plantas y un espejo redondo'] },
      { t: 'Añadir fotos', d: 'Toca <b>Añadir fotos</b> para tomar una foto o escoger varias del teléfono. Aparecen abajo para todos.', ex: [] },
    ],
    placeholder: 'Escribe un pendiente, un cambio, una pregunta o una nota…',
    tidy: 'Ordenar', addJob: 'Añadir como pendiente', saveNote: 'Guardar como nota', addPhotos: 'Añadir fotos',
    tidied: 'Ordenado · revísalo y guarda', changes: 'Cambios en Pendientes', saveThis: 'Guardar esto', keepEditing: 'Seguir editando',
    yourNotes: 'Tus notas', edit: 'Editar', photos: 'Fotos',
  },
};
