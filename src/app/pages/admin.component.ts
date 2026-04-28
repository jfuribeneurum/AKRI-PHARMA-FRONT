import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Administración multisede y perfiles</h1>
          <p class="page-subtitle">Gestiona sedes, usuarios, accesos por sede y perfiles operativos del ERP multiusuario.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0;">
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Sedes</h3>
              <div class="helper">Cada sede concentra sus almacenes, usuarios y equipos térmicos.</div>
            </div>
            <span class="chip primary">{{ sites().length }} sedes</span>
          </div>

          <div class="form-grid">
            <label>
              Código
              <input [(ngModel)]="siteForm.codigo" placeholder="BOG-CENTRAL">
            </label>
            <label>
              Nombre
              <input [(ngModel)]="siteForm.nombre" placeholder="Sede Central">
            </label>
            <label>
              Ciudad
              <input [(ngModel)]="siteForm.ciudad">
            </label>
            <label>
              Teléfono
              <input [(ngModel)]="siteForm.telefono">
            </label>
            <label>
              Email
              <input [(ngModel)]="siteForm.email">
            </label>
            <label>
              Responsable
              <input [(ngModel)]="siteForm.responsable">
            </label>
          </div>

          <label style="display:block; margin-top: 0.9rem; font-weight: 600;">
            Dirección
            <textarea [(ngModel)]="siteForm.direccion"></textarea>
          </label>

          <div class="switch-row">
            <label><input type="checkbox" [(ngModel)]="siteForm.es_principal"> Sede principal</label>
            <label><input type="checkbox" [(ngModel)]="siteForm.activo"> Activa</label>
          </div>

          <div class="form-actions">
            <button class="btn" (click)="saveSite()">{{ siteForm.id_sede ? 'Actualizar sede' : 'Crear sede' }}</button>
            <button class="btn secondary" (click)="resetSiteForm()">Limpiar</button>
          </div>

          <div class="table-wrap compact" style="margin-top: 1rem;">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Sede</th>
                  <th>Usuarios</th>
                  <th>Almacenes</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of sites()">
                  <td>{{ row.codigo }}</td>
                  <td>{{ row.nombre }}</td>
                  <td>{{ row.usuarios }}</td>
                  <td>{{ row.almacenes }}</td>
                  <td><button class="btn secondary btn-small" (click)="editSite(row)">Editar</button></td>
                </tr>
                <tr *ngIf="!sites().length">
                  <td colspan="5" class="muted">No hay sedes registradas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Perfiles</h3>
              <div class="helper">Perfiles con permisos granulares para inventario, frío, controlados y administración.</div>
            </div>
            <span class="chip accent">{{ profiles().length }} perfiles</span>
          </div>

          <div class="form-grid">
            <label>
              Nombre del perfil
              <input [(ngModel)]="profileForm.nombre" placeholder="SUPERVISOR_SEDE">
            </label>
            <label>
              Nivel jerárquico
              <input type="number" min="1" max="9" [(ngModel)]="profileForm.nivel_jerarquia">
            </label>
          </div>

          <label style="display:block; margin-top: 0.9rem; font-weight: 600;">
            Descripción
            <textarea [(ngModel)]="profileForm.descripcion"></textarea>
          </label>

          <div class="permissions-grid">
            <label *ngFor="let option of permissionOptions">
              <input type="checkbox" [(ngModel)]="profileForm[option.key]">
              {{ option.label }}
            </label>
          </div>

          <div class="switch-row">
            <label><input type="checkbox" [(ngModel)]="profileForm.es_activo"> Perfil activo</label>
          </div>

          <div class="form-actions">
            <button class="btn" (click)="saveProfile()">{{ profileForm.id_rol ? 'Actualizar perfil' : 'Crear perfil' }}</button>
            <button class="btn secondary" (click)="resetProfileForm()">Limpiar</button>
          </div>

          <div class="table-wrap compact" style="margin-top: 1rem;">
            <table>
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Nivel</th>
                  <th>Activo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of profiles()">
                  <td>{{ row.nombre }}</td>
                  <td>{{ row.nivel_jerarquia }}</td>
                  <td>{{ row.es_activo ? 'Sí' : 'No' }}</td>
                  <td><button class="btn secondary btn-small" (click)="editProfile(row)">Editar</button></td>
                </tr>
                <tr *ngIf="!profiles().length">
                  <td colspan="4" class="muted">No hay perfiles disponibles.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1rem;">
        <div class="card-header">
          <div>
            <h3>Usuarios y acceso por sede</h3>
            <div class="helper">Cada usuario puede tener un perfil, una sede predeterminada y acceso a varias sedes.</div>
          </div>
          <span class="chip info">{{ users().length }} usuarios</span>
        </div>

        <div class="form-grid">
          <label>
            Usuario
            <input [(ngModel)]="userForm.username">
          </label>
          <label>
            Contraseña
            <input [(ngModel)]="userForm.password" type="password" placeholder="Solo diligencia para crear o cambiar">
          </label>
          <label>
            Nombre
            <input [(ngModel)]="userForm.nombre">
          </label>
          <label>
            Apellido paterno
            <input [(ngModel)]="userForm.apellido_paterno">
          </label>
          <label>
            Apellido materno
            <input [(ngModel)]="userForm.apellido_materno">
          </label>
          <label>
            Email
            <input [(ngModel)]="userForm.email">
          </label>
          <label>
            Teléfono móvil
            <input [(ngModel)]="userForm.telefono_movil">
          </label>
          <label>
            Perfil
            <select [(ngModel)]="userForm.id_rol">
              <option [ngValue]="null">Selecciona un perfil</option>
              <option *ngFor="let row of profiles()" [ngValue]="row.id_rol">{{ row.nombre }}</option>
            </select>
          </label>
          <label>
            Sede predeterminada
            <select [(ngModel)]="userForm.id_sede">
              <option [ngValue]="null">Selecciona una sede</option>
              <option *ngFor="let row of sites()" [ngValue]="row.id_sede">{{ row.nombre }}</option>
            </select>
          </label>
          <label>
            Almacén principal
            <select [(ngModel)]="userForm.id_almacen_principal">
              <option [ngValue]="null">Sin almacén principal</option>
              <option *ngFor="let row of warehousesBySelectedSite()" [ngValue]="row.id_almacen">{{ row.nombre }}</option>
            </select>
          </label>
          <label>
            Número de empleado
            <input [(ngModel)]="userForm.numero_empleado">
          </label>
          <label>
            Cédula profesional
            <input [(ngModel)]="userForm.cedula_profesional">
          </label>
        </div>

        <div class="card" style="margin-top: 1rem; background: var(--surface-muted); box-shadow: none;">
          <h4 style="margin-bottom: 0.75rem;">Acceso a múltiples sedes</h4>
          <div class="permissions-grid">
            <label *ngFor="let row of sites()">
              <input type="checkbox" [checked]="userHasSite(row.id_sede)" (change)="toggleUserSite(row.id_sede, $any($event.target).checked)">
              {{ row.nombre }}
            </label>
          </div>

          <div class="switch-row" style="margin-top: 0.75rem;">
            <label><input type="checkbox" [(ngModel)]="userForm.es_activo"> Usuario activo</label>
            <label><input type="checkbox" [(ngModel)]="userForm.requiere_cambio_password"> Requiere cambio de contraseña</label>
            <label><input type="checkbox" [(ngModel)]="userForm.puede_admin_sede"> Puede administrar sus sedes</label>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn" (click)="saveUser()">{{ userForm.id_usuario ? 'Actualizar usuario' : 'Crear usuario' }}</button>
          <button class="btn secondary" (click)="resetUserForm()">Limpiar</button>
        </div>

        <div class="toolbar" style="margin-top: 1rem;">
          <input [(ngModel)]="userSearch" placeholder="Buscar usuario, email, perfil o sede">
          <button class="btn secondary" (click)="loadUsers()">Buscar</button>
        </div>

        <div class="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Perfil</th>
                <th>Sede</th>
                <th>Sedes</th>
                <th>Activo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of users()">
                <td>
                  <strong>{{ row.nombre_completo }}</strong>
                  <div class="muted">{{ row.username }} · {{ row.email }}</div>
                </td>
                <td>{{ row.perfil }}</td>
                <td>{{ row.sede }}</td>
                <td>{{ row.sedes_asignadas }}</td>
                <td>{{ row.es_activo ? 'Sí' : 'No' }}</td>
                <td><button class="btn secondary btn-small" (click)="editUser(row)">Editar</button></td>
              </tr>
              <tr *ngIf="!users().length">
                <td colspan="6" class="muted">No hay usuarios para los filtros actuales.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `
})
export class AdminComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly sites = signal<any[]>([]);
  readonly profiles = signal<any[]>([]);
  readonly users = signal<any[]>([]);
  readonly warehouses = signal<any[]>([]);

  userSearch = '';

  permissionOptions = [
    { key: 'perm_inventario_consulta', label: 'Inventario consulta' },
    { key: 'perm_inventario_movimiento', label: 'Inventario movimiento' },
    { key: 'perm_inventario_ajuste', label: 'Inventario ajuste' },
    { key: 'perm_compras_solicitar', label: 'Compras solicitar' },
    { key: 'perm_compras_aprobar', label: 'Compras aprobar' },
    { key: 'perm_compras_recibir', label: 'Compras recibir' },
    { key: 'perm_ventas_dispensar', label: 'Dispensar' },
    { key: 'perm_ventas_facturar', label: 'Facturar' },
    { key: 'perm_controlados_dispensar', label: 'Controlados' },
    { key: 'perm_controlados_libro', label: 'Libro controlados' },
    { key: 'perm_cadena_frio_consulta', label: 'Frío consulta' },
    { key: 'perm_cadena_frio_registro', label: 'Frío registro' },
    { key: 'perm_cadena_frio_aprobar_excursion', label: 'Frío excursiones' },
    { key: 'perm_reportes_operativos', label: 'Reportes operativos' },
    { key: 'perm_reportes_financieros', label: 'Reportes financieros' },
    { key: 'perm_configuracion', label: 'Configuración' },
    { key: 'perm_usuarios_gestionar', label: 'Gestionar usuarios' },
    { key: 'perm_auditoria_consulta', label: 'Auditoría' }
  ];

  siteForm: any = this.blankSite();
  profileForm: any = this.blankProfile();
  userForm: any = this.blankUser();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      this.message.set('');
      const [lookups, sites, profiles] = await Promise.all([
        this.api.get<{ success: boolean; data: any }>('/admin/lookups'),
        this.api.get<{ success: boolean; data: any[] }>('/admin/sites'),
        this.api.get<{ success: boolean; data: any[] }>('/admin/profiles')
      ]);

      this.sites.set(sites.data);
      this.profiles.set(profiles.data);
      this.warehouses.set(lookups.data.warehouses ?? []);
      await this.loadUsers();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar la administración.');
    }
  }

  async loadUsers() {
    try {
      const response = await this.api.get<{ success: boolean; data: any[] }>(`/admin/users?search=${encodeURIComponent(this.userSearch)}`);
      this.users.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar usuarios.');
    }
  }

  async saveSite() {
    try {
      this.error.set('');
      if (this.siteForm.id_sede) {
        await this.api.put(`/admin/sites/${this.siteForm.id_sede}`, this.siteForm);
        this.message.set('Sede actualizada.');
      } else {
        await this.api.post('/admin/sites', this.siteForm);
        this.message.set('Sede creada.');
      }
      this.resetSiteForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar la sede.');
    }
  }

  async saveProfile() {
    try {
      this.error.set('');
      if (this.profileForm.id_rol) {
        await this.api.put(`/admin/profiles/${this.profileForm.id_rol}`, this.profileForm);
        this.message.set('Perfil actualizado.');
      } else {
        await this.api.post('/admin/profiles', this.profileForm);
        this.message.set('Perfil creado.');
      }
      this.resetProfileForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar el perfil.');
    }
  }

  async saveUser() {
    try {
      this.error.set('');
      const payload = {
        ...this.userForm,
        site_ids: this.userForm.site_ids
      };
      if (this.userForm.id_usuario) {
        if (!payload.password) {
          delete payload.password;
        }
        await this.api.put(`/admin/users/${this.userForm.id_usuario}`, payload);
        this.message.set('Usuario actualizado.');
      } else {
        await this.api.post('/admin/users', payload);
        this.message.set('Usuario creado.');
      }
      this.resetUserForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible guardar el usuario.');
    }
  }

  editSite(row: any) {
    this.siteForm = { ...row };
  }

  editProfile(row: any) {
    const next = this.blankProfile();
    for (const key of Object.keys(next)) {
      if (row[key] !== undefined) {
        next[key] = row[key];
      }
    }
    next.id_rol = row.id_rol;
    this.profileForm = next;
  }

  editUser(row: any) {
    this.userForm = {
      id_usuario: row.id_usuario,
      username: row.username,
      password: '',
      nombre: row.nombre,
      apellido_paterno: row.apellido_paterno,
      apellido_materno: row.apellido_materno,
      email: row.email,
      telefono_movil: row.telefono_movil,
      id_rol: row.id_rol,
      id_sede: row.id_sede,
      id_almacen_principal: row.id_almacen_principal,
      numero_empleado: row.numero_empleado,
      cedula_profesional: row.cedula_profesional,
      fecha_ingreso: row.fecha_ingreso,
      es_activo: row.es_activo,
      requiere_cambio_password: false,
      puede_admin_sede: Boolean(row.access?.some((item: any) => item.puede_admin_sede)),
      site_ids: (row.access ?? []).map((item: any) => Number(item.id_sede))
    };
  }

  warehousesBySelectedSite() {
    return this.warehouses().filter((row) => !this.userForm.id_sede || Number(row.id_sede) === Number(this.userForm.id_sede));
  }

  userHasSite(idSede: number) {
    return (this.userForm.site_ids ?? []).includes(idSede);
  }

  toggleUserSite(idSede: number, checked: boolean) {
    const current = new Set<number>((this.userForm.site_ids ?? []).map((value: any) => Number(value)));
    if (checked) {
      current.add(Number(idSede));
    } else {
      current.delete(Number(idSede));
    }
    this.userForm.site_ids = Array.from(current);
  }

  resetSiteForm() {
    this.siteForm = this.blankSite();
  }

  resetProfileForm() {
    this.profileForm = this.blankProfile();
  }

  resetUserForm() {
    this.userForm = this.blankUser();
  }

  private blankSite() {
    return {
      id_sede: null,
      codigo: '',
      nombre: '',
      ciudad: '',
      direccion: '',
      telefono: '',
      email: '',
      responsable: '',
      es_principal: false,
      activo: true
    };
  }

  private blankProfile() {
    const form: any = {
      id_rol: null,
      nombre: '',
      descripcion: '',
      nivel_jerarquia: 5,
      es_activo: true
    };
    for (const option of this.permissionOptions) {
      form[option.key] = false;
    }
    return form;
  }

  private blankUser() {
    return {
      id_usuario: null,
      username: '',
      password: '',
      nombre: '',
      apellido_paterno: '',
      apellido_materno: '',
      email: '',
      telefono_movil: '',
      id_rol: null,
      id_sede: null,
      id_almacen_principal: null,
      numero_empleado: '',
      cedula_profesional: '',
      fecha_ingreso: '',
      es_activo: true,
      requiere_cambio_password: false,
      puede_admin_sede: false,
      site_ids: []
    };
  }
}
